"""
UDID / disability-ID authentication via QR + EasyOCR.

Accept real UDID cards even when phone-OCR is noisy.
Reject chat/IDE screens that only mention Blindness/UDID.
Supports multi-orientation OCR (0°, 180°, 90°, 270°), card-back detection,
and real-time card positioning guidance for visually impaired users.
"""

from __future__ import annotations

import io
import json
import re
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

VISUAL_IMPAIRMENT_TERMS = (
    "blindness",
    "blindnes",
    "blind",
    "low vision",
    "lowvision",
    "low-vision",
    "visual impairment",
    "visualimpairment",
    "visually impaired",
    "vision impairment",
    "sight impairment",
    "completely blind",
    "total blindness",
    "partial blindness",
    "vision handicapped",
)

# OCR often garbles Blindness → alindness / blndnaan / auindnet / amiadntad / bllndness
VI_FUZZY = re.compile(
    r"(?:blind(?:ness|nes)?|bl[i1l]?nd[a-z]{0,6}|"
    r"[aau][lmiu]?[i1l]?nd[a-z]{0,6}|l[o0]w\s*v[i1]s[i1][o0]n|"
    r"v[i1]sua[l1]\s*impair)",
    re.IGNORECASE,
)

_VI_BLOCKLIST = {
    "india",
    "indian",
    "and",
    "under",
    "random",
    "permanent",
    "authority",
    "disability",
    "locomotor",
    "hearing",
    "government",
}


def _fuzzy_blindness_in_text(text: str) -> bool:
    if VI_FUZZY.search(text):
        return True
    for raw in re.findall(r"[A-Za-z]{5,12}", text):
        token = raw.lower()
        if token in _VI_BLOCKLIST:
            continue
        if SequenceMatcher(None, token, "blindness").ratio() >= 0.55:
            return True
        if SequenceMatcher(None, token, "blind").ratio() >= 0.75:
            return True
    return False

CARD_MARKERS = (
    "unique disability",
    "disability id",
    "government of india",
    "disability type",
    "ud id",
    "udid",
    "% of disability",
    "percent of disability",
    "issuing authority",
    "valid upto",
    "valid until",
    "year of birth",
    "date of issue",
)

CARD_BACK_MARKERS = (
    "medical authority",
    "chief medical officer",
    "medical superintendent",
    "civil surgeon",
    "issuing medical",
    "district medical",
    "address :",
    "address:",
    "address",
    "father's name",
    "father name",
    "mother's name",
    "identification mark",
    "blood group",
    "pin code",
    "registration no",
    "sign of card holder",
    "signature of holder",
    "state :",
    "district :",
)

REJECT_MARKERS = (
    "reload the app",
    "server/udid",
    "udid_scans",
    "smoke test",
    "double tap",
    "easyocr",
    "background tasks",
    "hold still for",
    "authentication successful",
    "frames for qr",
    "sharpest frames",
    "gpu server",
    "processingms",
    "finished 3 background",
    "npm run",
)

_reader = None


def get_reader():
    global _reader
    if _reader is None:
        import easyocr

        try:
            import torch

            use_gpu = torch.cuda.is_available()
        except ImportError:
            use_gpu = False

        base_dir = Path(__file__).resolve().parent / ".easyocr"
        model_dir = base_dir / "model"
        net_dir = base_dir / "user_network"
        model_dir.mkdir(parents=True, exist_ok=True)
        net_dir.mkdir(parents=True, exist_ok=True)

        _reader = easyocr.Reader(
            ["en"],
            gpu=use_gpu,
            model_storage_directory=str(model_dir),
            user_network_directory=str(net_dir),
        )
    return _reader


def decode_image(image_bytes: bytes) -> np.ndarray:
    frame: np.ndarray | None = None
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            corrected = ImageOps.exif_transpose(image).convert("RGB")
            frame = cv2.cvtColor(np.asarray(corrected), cv2.COLOR_RGB2BGR)
    except (UnidentifiedImageError, OSError, ValueError):
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode ID image")
    return frame


def sharpness_score(frame: np.ndarray) -> float:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def analyze_card_position(frame: np.ndarray) -> dict[str, Any]:
    """
    Guide the scan from readable ID details, not the card's outer boundary.
    """
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    brightness = float(gray.mean())
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if brightness < 35.0:
        return {
            "cardDetected": False,
            "readyToScan": False,
            "status": "too_dark",
            "spokenInstruction": "It is too dark. Move closer to a light or turn on the room light.",
            "metrics": {"brightness": round(brightness, 1), "sharpness": round(sharpness, 1)},
        }

    if brightness > 235.0:
        return {
            "cardDetected": False,
            "readyToScan": False,
            "status": "too_bright",
            "spokenInstruction": "There is too much glare. Tilt the ID text slightly away from the light.",
            "metrics": {"brightness": round(brightness, 1), "sharpness": round(sharpness, 1)},
        }

    qr_text = scan_qr(frame)
    ocr_lines = run_ocr_on_frame(frame)
    preview = _auth_result_from_text(
        qr_text,
        ocr_lines,
        frames_used=1,
        best_sharpness=sharpness,
    )
    if preview.get("authenticated"):
        return {
            "cardDetected": True,
            "readyToScan": True,
            "status": "aligned",
            "spokenInstruction": (
                "I can read the required ID details. Hold steady; scanning automatically. "
                "The whole card does not need to fit in the frame."
            ),
            "metrics": {
                "brightness": round(brightness, 1),
                "sharpness": round(sharpness, 1),
                "qrFound": bool(qr_text),
                "readableTextLines": len(ocr_lines),
            },
        }

    if preview.get("reason") in {"card_back_detected", "not_visual_impairment"}:
        return {
            "cardDetected": True,
            "readyToScan": False,
            "status": "no_card",
            "spokenInstruction": str(preview["message"]),
            "metrics": {
                "brightness": round(brightness, 1),
                "sharpness": round(sharpness, 1),
                "qrFound": bool(qr_text),
                "readableTextLines": len(ocr_lines),
            },
        }

    if ocr_lines or qr_text:
        return {
            "cardDetected": True,
            "readyToScan": False,
            "status": "too_blurry" if sharpness < 18.0 else "no_card",
            "spokenInstruction": (
                "I can see text, but cannot read enough ID details yet. Keep the ID number "
                "and Disability Type text steady in view. The whole card does not need to fit."
            ),
            "metrics": {
                "brightness": round(brightness, 1),
                "sharpness": round(sharpness, 1),
                "qrFound": bool(qr_text),
                "readableTextLines": len(ocr_lines),
            },
        }

    if sharpness < 18.0:
        return {
            "cardDetected": False,
            "readyToScan": False,
            "status": "too_blurry",
            "spokenInstruction": (
                "Hold steady so I can read the ID number and Disability Type. "
                "The whole card does not need to fit."
            ),
            "metrics": {
                "brightness": round(brightness, 1),
                "sharpness": round(sharpness, 1),
                "qrFound": False,
                "readableTextLines": 0,
            },
        }

    max_dim = 640
    scale = max_dim / float(max(h, w))
    small = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    small_gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    sh, sw = small.shape[:2]
    s_area = sw * sh

    best_box = None
    best_area = 0

    blurred = cv2.bilateralFilter(small_gray, 9, 75, 75)
    edges = cv2.Canny(blurred, 30, 100)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    dilated = cv2.dilate(edges, kernel, iterations=2)
    dilated = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, kernel, iterations=1)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in contours:
        area = cv2.contourArea(c)
        if area < s_area * 0.08:
            continue
        bx, by, bw, bh = cv2.boundingRect(c)
        ratio = max(bw, bh) / float(min(bw, bh)) if min(bw, bh) > 0 else 0
        if 1.15 <= ratio <= 2.2:
            rect_area = bw * bh
            extent = float(area) / rect_area if rect_area > 0 else 0
            if extent >= 0.5:
                if area > best_area:
                    best_area = area
                    best_box = (bx, by, bw, bh, ratio)

    if not best_box:
        _, otsu = cv2.threshold(small_gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(otsu, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for c in contours:
            area = cv2.contourArea(c)
            if area < s_area * 0.08:
                continue
            bx, by, bw, bh = cv2.boundingRect(c)
            ratio = max(bw, bh) / float(min(bw, bh)) if min(bw, bh) > 0 else 0
            if 1.15 <= ratio <= 2.2:
                if area > best_area:
                    best_area = area
                    best_box = (bx, by, bw, bh, ratio)

    qr_detector = cv2.QRCodeDetector()
    qr_found, qr_points = qr_detector.detect(small_gray)
    if qr_found and not best_box:
        pts = qr_points[0]
        q_min = pts.min(axis=0)
        q_max = pts.max(axis=0)
        qw = q_max[0] - q_min[0]
        approx_cw = min(sw, int(qw * 3.5))
        approx_ch = int(approx_cw / 1.58)
        cx = (q_min[0] + q_max[0]) / 2.0
        cy = (q_min[1] + q_max[1]) / 2.0
        bx = max(0, int(cx - approx_cw / 2))
        by = max(0, int(cy - approx_ch / 2))
        best_box = (bx, by, min(sw - bx, approx_cw), min(sh - by, approx_ch), 1.58)

    if not best_box:
        center_crop = small_gray[int(sh * 0.2) : int(sh * 0.8), int(sw * 0.2) : int(sw * 0.8)]
        center_sharp = float(cv2.Laplacian(center_crop, cv2.CV_64F).var())
        if center_sharp > 30.0:
            best_box = (0, 0, sw, sh, sw / float(sh) if sh > 0 else 1.33)

    if not best_box:
        return {
            "cardDetected": False,
            "readyToScan": False,
            "status": "no_card",
            "spokenInstruction": (
                "I cannot find readable ID details yet. Hold the ID number and "
                "Disability Type text in view; the whole card does not need to fit."
            ),
            "metrics": {
                "brightness": round(brightness, 1),
                "sharpness": round(sharpness, 1),
                "qrFound": bool(qr_found),
            },
        }

    bx, by, bw, bh, ratio = best_box
    coverage = float(bw * bh) / float(s_area)
    center_x = (bx + bw / 2.0) / float(sw)
    center_y = (by + bh / 2.0) / float(sh)
    offset_x = center_x - 0.5
    offset_y = center_y - 0.5
    orig_box = [int(bx / scale), int(by / scale), int(bw / scale), int(bh / scale)]

    if sharpness < 18.0:
        return {
            "cardDetected": True,
            "readyToScan": False,
            "status": "too_blurry",
            "spokenInstruction": "Hold steady so I can focus on the ID details.",
            "box": orig_box,
            "metrics": {
                "coverage": round(coverage, 2),
                "offsetX": round(offset_x, 2),
                "offsetY": round(offset_y, 2),
                "sharpness": round(sharpness, 1),
                "brightness": round(brightness, 1),
                "qrFound": bool(qr_found),
            },
        }

    if coverage < 0.16:
        status = "too_far"
        instruction = "Move the ID text a little closer until it is readable. The whole card does not need to fit."
        ready = False
    elif coverage > 0.90:
        status = "too_close"
        instruction = "Move the ID text slightly farther away if it is out of focus. The whole card does not need to fit."
        ready = False
    elif offset_x < -0.16:
        status = "move_right"
        instruction = "Move the ID details slightly to the right."
        ready = False
    elif offset_x > 0.16:
        status = "move_left"
        instruction = "Move the ID details slightly to the left."
        ready = False
    elif offset_y < -0.16:
        status = "move_down"
        instruction = "Move the ID details slightly down."
        ready = False
    elif offset_y > 0.16:
        status = "move_up"
        instruction = "Move the ID details slightly up."
        ready = False
    else:
        status = "no_card"
        instruction = (
            "The ID details are not readable yet. Keep the ID number and Disability Type "
            "text in view; the whole card does not need to fit."
        )
        ready = False

    return {
        "cardDetected": True,
        "readyToScan": ready,
        "status": status,
        "spokenInstruction": instruction,
        "box": orig_box,
        "orientationHint": "landscape" if ratio >= 1.25 else "portrait",
        "metrics": {
            "coverage": round(coverage, 2),
            "offsetX": round(offset_x, 2),
            "offsetY": round(offset_y, 2),
            "sharpness": round(sharpness, 1),
            "brightness": round(brightness, 1),
            "qrFound": bool(qr_found),
        },
    }


def prepare_for_ocr(frame: np.ndarray, max_side: int = 1100) -> np.ndarray:
    h, w = frame.shape[:2]
    if max(h, w) > max_side:
        scale = max_side / float(max(h, w))
        frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return frame


def _clahe_bgr(frame: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(gray)
    return cv2.cvtColor(clahe, cv2.COLOR_GRAY2BGR)


def scan_qr(frame: np.ndarray) -> str | None:
    detector = cv2.QRCodeDetector()
    small = prepare_for_ocr(frame)
    for variant in (small, _clahe_bgr(small)):
        data, _points, _ = detector.detectAndDecode(variant)
        if data and str(data).strip():
            return str(data).strip()
        gray = cv2.cvtColor(variant, cv2.COLOR_BGR2GRAY)
        data2, _points2, _ = detector.detectAndDecode(gray)
        if data2 and str(data2).strip():
            return str(data2).strip()
    return None


def _ocr_rgb(rgb: np.ndarray) -> list[str]:
    reader = get_reader()
    try:
        results = reader.readtext(rgb, detail=0, paragraph=False, batch_size=4)
    except Exception:  # noqa: BLE001
        return []
    lines: list[str] = []
    seen: set[str] = set()
    for item in results:
        text = _normalize(str(item))
        key = text.lower()
        if text and key not in seen and len(text) >= 2:
            seen.add(key)
            lines.append(text)
    return lines


def run_ocr_on_frame(frame: np.ndarray, *, use_clahe: bool = False) -> list[str]:
    prepared = prepare_for_ocr(frame)
    if use_clahe:
        prepared = _clahe_bgr(prepared)
    return _ocr_rgb(cv2.cvtColor(prepared, cv2.COLOR_BGR2RGB))


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _flat_text(lines: list[str]) -> str:
    """Join OCR lines so split headers like UNIQUE + DISABILITY ID still match."""
    return _normalize(" ".join(lines))


def parse_qr_payload(qr_text: str) -> dict[str, str]:
    fields: dict[str, str] = {"raw_qr": qr_text}
    try:
        parsed = json.loads(qr_text)
        if isinstance(parsed, dict):
            for key, value in parsed.items():
                fields[str(key).lower()] = str(value)
            return fields
    except json.JSONDecodeError:
        pass
    fields["ocr_blob"] = qr_text
    return fields


def _repair_udid_candidate(raw: str) -> str | None:
    """Fix common OCR mistakes on Indian UDID numbers (PB misread as P0/P8/PO)."""
    cleaned = re.sub(r"[^A-Za-z0-9]", "", raw).upper()
    if len(cleaned) < 12:
        return None

    # Pure digits from a bad OCR of the ID line — keep if long enough
    if cleaned.isdigit() and 15 <= len(cleaned) <= 20:
        return cleaned

    # Letter + digit OCR of state code: P0… / P8… / PO… → PB…
    if re.fullmatch(r"[A-Z][0-9O]\d{13,19}", cleaned):
        fixed = cleaned[0] + "B" + cleaned[2:]
        if re.fullmatch(r"[A-Z]{2}\d{14,20}", fixed):
            return fixed

    # Normal: PB0710219680033443
    if re.fullmatch(r"[A-Z]{2}\d{14,20}", cleaned):
        return cleaned

    # Soft: 2 alnum + many digits
    if re.fullmatch(r"[A-Z0-9]{2}\d{12,20}", cleaned):
        digits = sum(ch.isdigit() for ch in cleaned)
        if digits >= 12:
            # Prefer letter-letter prefix when second char is digit/O
            if cleaned[1] in "08O" and cleaned[0].isalpha():
                return cleaned[0] + "B" + cleaned[2:]
            return cleaned

    return None


def _looks_like_udid(candidate: str) -> bool:
    return _repair_udid_candidate(candidate) is not None


def extract_fields_from_text(blob: str) -> dict[str, str]:
    text = blob
    flat = _normalize(blob.replace("\n", " "))
    lower = flat.lower()
    fields: dict[str, str] = {}

    udid_patterns = [
        r"(?:ud\s*id|udid|uu\s*iu|md\s*d)\s*[:\-]?\s*([A-Z0-9][A-Z0-9O][\dO]{10,20})",
        r"\b([A-Z]{2}\d{14,20})\b",
        r"\b([A-Z][0-9O]\d{13,19})\b",
        r"\b(\d{15,20})\b",
    ]
    for pattern in udid_patterns:
        match = re.search(pattern, flat, flags=re.IGNORECASE)
        if match:
            repaired = _repair_udid_candidate(match.group(1))
            if repaired:
                fields["udid"] = repaired
                break

    pct = re.search(r"\b(100|[1-9]?\d)\s*%", flat)
    if pct:
        value = int(pct.group(1))
        if 1 <= value <= 100:
            fields["disability_percentage"] = str(value)
    else:
        # OCR often drops % → "100 (" or "1097" near disability
        pct2 = re.search(
            r"(?:%\s*of\s*disability|of\s*disability|hundred)\D{0,12}(100|[4-9]\d)\b",
            lower,
        )
        if pct2:
            value = int(pct2.group(1))
            if 1 <= value <= 100:
                fields["disability_percentage"] = str(value)

    type_match = re.search(
        r"disability\s*type\s*[:\-]?\s*([A-Za-z][A-Za-z\s\-]{2,40})",
        flat,
        flags=re.IGNORECASE,
    )
    if type_match:
        dtype = _normalize(type_match.group(1))
        dtype = re.split(
            r"\b(?:year|date|valid|percent|%|udid|name|dob|birth)\b",
            dtype,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0].strip(" :-")
        if dtype:
            fields["disability_type"] = dtype[:80]

    if _fuzzy_blindness_in_text(flat):
        fields["disability_type"] = "Blindness"
    else:
        for term in VISUAL_IMPAIRMENT_TERMS:
            if term in lower:
                fields.setdefault("disability_type", term.title())
                break

    fields["raw_text"] = text[:2000]
    return fields


def is_rejected_non_card_text(full_text: str) -> bool:
    lower = full_text.lower()
    return any(marker in lower for marker in REJECT_MARKERS)


def is_card_back(full_text: str) -> bool:
    lower = _normalize(full_text.replace("\n", " ")).lower()
    hits = sum(1 for marker in CARD_BACK_MARKERS if marker in lower)
    if (
        "address" in lower
        and any(
            m in lower
            for m in (
                "medical",
                "authority",
                "officer",
                "pin",
                "father",
                "district",
                "hospital",
                "board",
            )
        )
    ) or hits >= 2:
        return True
    return False


def _card_marker_hits(flat_lower: str) -> int:
    hits = sum(1 for marker in CARD_MARKERS if marker in flat_lower)
    # Split-header OCR: "unique" ... "disability" ... "id"
    if "unique" in flat_lower and "disability" in flat_lower:
        hits = max(hits, 2)
    if re.search(r"disabilit", flat_lower) and re.search(
        r"\bud\b|udid|unique|government|india",
        flat_lower,
    ):
        hits = max(hits, 2)
    return hits


def looks_like_udid_card(fields: dict[str, str], full_text: str) -> bool:
    if is_rejected_non_card_text(full_text):
        return False

    flat = _normalize(full_text.replace("\n", " "))
    lower = flat.lower()
    marker_hits = _card_marker_hits(lower)
    has_udid = bool(fields.get("udid") and _looks_like_udid(fields["udid"]))
    has_vi = bool(_fuzzy_blindness_in_text(flat) or is_visual_impairment(fields, flat))

    # Strong: UDID number + card labels
    if has_udid and marker_hits >= 1:
        return True
    # Strong: clear UDID card header + visual impairment (number OCR failed)
    if marker_hits >= 2 and has_vi:
        return True
    # Medium: "unique disability id" (even split) + VI fuzzy
    if "disability" in lower and has_vi and ("unique" in lower or marker_hits >= 1):
        return True
    if has_udid and fields.get("disability_type"):
        return True
    return False


def is_visual_impairment(fields: dict[str, str], full_text: str) -> bool:
    dtype = (fields.get("disability_type") or "").lower()
    if dtype and _fuzzy_blindness_in_text(dtype):
        return True
    if any(term in dtype for term in VISUAL_IMPAIRMENT_TERMS):
        return True

    flat = _normalize(full_text.replace("\n", " "))
    if _fuzzy_blindness_in_text(flat):
        return True

    lower = flat.lower()
    if re.search(
        r"disability\s*type\s*[:\-]?\s*.{0,40}(blind|low\s*vision|visual\s*impair)",
        lower,
    ):
        return True
    return False


def _auth_result_from_text(
    qr_text: str | None,
    ocr_lines: list[str],
    *,
    frames_used: int,
    best_sharpness: float,
) -> dict[str, Any]:
    ocr_blob = "\n".join(ocr_lines)
    flat_blob = _flat_text(ocr_lines)

    if not qr_text and not flat_blob.strip():
        is_blurry = best_sharpness < 18.0
        return {
            "authenticated": False,
            "reason": "too_blurry" if is_blurry else "no_text",
            "message": (
                "The ID details were too blurry. Hold steady and keep the ID number and "
                "Disability Type readable; the whole card does not need to fit."
                if is_blurry
                else "I could not read the ID details. Hold the ID number and Disability Type text steady in view; the whole card does not need to fit."
            ),
            "source": None,
            "fields": {},
            "qrFound": False,
            "ocrLines": [],
            "framesUsed": frames_used,
            "bestSharpness": round(best_sharpness, 1),
        }

    fields: dict[str, str] = {}
    source = "ocr"
    full_text = ocr_blob
    parse_text = flat_blob

    if qr_text:
        source = "qr"
        fields.update(parse_qr_payload(qr_text))
        full_text = f"{qr_text}\n{ocr_blob}"
        parse_text = f"{qr_text} {flat_blob}"

    ocr_fields = extract_fields_from_text(parse_text if parse_text.strip() else full_text)
    for key, value in ocr_fields.items():
        fields.setdefault(key, value)

    if qr_text:
        qr_fields = extract_fields_from_text(qr_text)
        for key, value in qr_fields.items():
            fields.setdefault(key, value)

    # Normalize repaired UDID
    if fields.get("udid"):
        repaired = _repair_udid_candidate(fields["udid"])
        if repaired:
            fields["udid"] = repaired

    marker_hits = _card_marker_hits(_normalize(full_text.replace("\n", " ")).lower())
    visual_ok = is_visual_impairment(fields, full_text)
    card_ok = looks_like_udid_card(fields, full_text)
    has_udid = bool(fields.get("udid") and _looks_like_udid(fields["udid"]))
    base_meta = {
        "framesUsed": frames_used,
        "bestSharpness": round(best_sharpness, 1),
        "qrFound": bool(qr_text),
        "ocrLines": ocr_lines[:50],
        "cardMarkers": marker_hits,
    }

    if is_rejected_non_card_text(full_text):
        return {
            "authenticated": False,
            "reason": "not_id_card",
            "message": "That does not look like a disability ID. Keep the ID number and Disability Type text visible, then try again.",
            "source": source,
            "fields": {
                "udid": fields.get("udid"),
                "disability_type": fields.get("disability_type"),
                "disability_percentage": fields.get("disability_percentage"),
            },
            **base_meta,
        }

    if is_card_back(full_text) and not visual_ok:
        return {
            "authenticated": False,
            "reason": "card_back_detected",
            "message": "This is the back of your disability card. Please turn the card over so the front with your photo and disability type is facing the camera.",
            "source": source,
            "fields": {
                "udid": fields.get("udid"),
                "disability_type": fields.get("disability_type"),
                "disability_percentage": fields.get("disability_percentage"),
            },
            **base_meta,
        }

    # Pass if card + VI; UDID preferred but not mandatory when OCR of number fails
    # but header + Blindness are clear (common on blurry phone-of-screen shots)
    if card_ok and visual_ok and (has_udid or marker_hits >= 2):
        return {
            "authenticated": True,
            "reason": "visual_impairment_verified",
            "message": "Authentication successful. Visual impairment verified. Opening Drishti assistance.",
            "source": source,
            "fields": {
                "udid": fields.get("udid"),
                "disability_type": fields.get("disability_type")
                or fields.get("category")
                or fields.get("type")
                or "Blindness",
                "disability_percentage": fields.get("disability_percentage"),
                "other": {
                    k: v
                    for k, v in fields.items()
                    if k
                    not in {
                        "udid",
                        "disability_type",
                        "disability_percentage",
                        "raw_text",
                        "raw_qr",
                        "ocr_blob",
                    }
                },
            },
            **base_meta,
        }

    if not card_ok:
        return {
            "authenticated": False,
            "reason": "not_id_card",
            "message": "I could not confirm the ID details. Keep the ID number and Disability Type readable; the whole card does not need to fit.",
            "source": source,
            "fields": {
                "udid": fields.get("udid"),
                "disability_type": fields.get("disability_type"),
                "disability_percentage": fields.get("disability_percentage"),
            },
            **base_meta,
        }

    if not visual_ok:
        return {
            "authenticated": False,
            "reason": "not_visual_impairment",
            "message": "I read the ID details, but did not find a visual impairment category such as Blindness or Low Vision. Keep Disability Type readable; the whole card does not need to fit.",
            "source": source,
            "fields": {
                "udid": fields.get("udid"),
                "disability_type": fields.get("disability_type"),
                "disability_percentage": fields.get("disability_percentage"),
            },
            **base_meta,
        }

    return {
        "authenticated": False,
        "reason": "incomplete",
        "message": "I could not fully verify the disability ID. Keep the ID number and Disability Type text steady and readable under good light.",
        "source": source,
        "fields": {
            "udid": fields.get("udid"),
            "disability_type": fields.get("disability_type"),
            "disability_percentage": fields.get("disability_percentage"),
        },
        **base_meta,
    }


def authenticate_udid_image(image_bytes: bytes) -> dict[str, Any]:
    return authenticate_udid_images([image_bytes])


ROTATION_OPS = [
    (0, None),
    (180, cv2.ROTATE_180),
    (90, cv2.ROTATE_90_CLOCKWISE),
    (270, cv2.ROTATE_90_COUNTERCLOCKWISE),
]


def authenticate_udid_images(image_list: list[bytes]) -> dict[str, Any]:
    """
    Authenticate using hold-window frames.
    Evaluates multi-orientation OCR (0°, 180°, 90°, 270°) to support blind users
    who may hold cards inverted or sideways.
    Detects front vs back of card to give clear audio feedback.
    """
    if not image_list:
        raise ValueError("No ID frames provided")

    scored: list[tuple[float, np.ndarray, bytes]] = []
    for raw in image_list:
        try:
            frame = decode_image(raw)
        except ValueError:
            continue
        scored.append((sharpness_score(frame), frame, raw))

    if not scored:
        raise ValueError("Could not decode any ID frames")

    scored.sort(key=lambda item: item[0], reverse=True)
    best_sharpness = scored[0][0]

    # Fast QR scan across all 4 orientations on top 2 frames
    qr_text: str | None = None
    for _score, frame, _raw in scored[:2]:
        for _angle, rot_op in ROTATION_OPS:
            rot_frame = frame if rot_op is None else cv2.rotate(frame, rot_op)
            found = scan_qr(rot_frame)
            if found:
                qr_text = found
                break
        if qr_text:
            break

    card_back_probe: dict[str, Any] | None = None
    best_probe: dict[str, Any] | None = None

    # Step 1: Multi-orientation OCR on the sharpest frame
    f0 = scored[0][1]
    for angle, rot_op in ROTATION_OPS:
        rot_frame = f0 if rot_op is None else cv2.rotate(f0, rot_op)
        lines = run_ocr_on_frame(rot_frame, use_clahe=False)
        if not lines:
            continue
        probe = _auth_result_from_text(
            qr_text,
            lines,
            frames_used=len(scored),
            best_sharpness=best_sharpness,
        )
        probe["orientation"] = angle
        if probe.get("authenticated"):
            return probe
        if probe.get("reason") == "card_back_detected" and not card_back_probe:
            card_back_probe = probe
        if best_probe is None or probe.get("cardMarkers", 0) > best_probe.get("cardMarkers", 0):
            best_probe = probe

    # Step 2: CLAHE on 0° and 180° for glare / reflective cards
    for angle, rot_op in [(0, None), (180, cv2.ROTATE_180)]:
        rot_frame = f0 if rot_op is None else cv2.rotate(f0, rot_op)
        lines = run_ocr_on_frame(rot_frame, use_clahe=True)
        if not lines:
            continue
        probe = _auth_result_from_text(
            qr_text,
            lines,
            frames_used=len(scored),
            best_sharpness=best_sharpness,
        )
        probe["orientation"] = angle
        if probe.get("authenticated"):
            return probe
        if probe.get("reason") == "card_back_detected" and not card_back_probe:
            card_back_probe = probe
        if best_probe is None or probe.get("cardMarkers", 0) > best_probe.get("cardMarkers", 0):
            best_probe = probe

    # Step 3: Second frame check if available (0° and 180°)
    if len(scored) > 1:
        f1 = scored[1][1]
        for angle, rot_op in [(0, None), (180, cv2.ROTATE_180)]:
            rot_frame = f1 if rot_op is None else cv2.rotate(f1, rot_op)
            lines = run_ocr_on_frame(rot_frame, use_clahe=False)
            if not lines:
                continue
            probe = _auth_result_from_text(
                qr_text,
                lines,
                frames_used=len(scored),
                best_sharpness=best_sharpness,
            )
            probe["orientation"] = angle
            if probe.get("authenticated"):
                return probe
            if probe.get("reason") == "card_back_detected" and not card_back_probe:
                card_back_probe = probe
            if best_probe is None or probe.get("cardMarkers", 0) > best_probe.get("cardMarkers", 0):
                best_probe = probe

    # If back of card was detected in any orientation, inform the blind user!
    if card_back_probe is not None:
        return card_back_probe

    if best_probe is not None:
        return best_probe

    return _auth_result_from_text(
        qr_text,
        [],
        frames_used=len(scored),
        best_sharpness=best_sharpness,
    )
