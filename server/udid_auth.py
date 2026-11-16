"""
UDID / disability-ID authentication via QR + EasyOCR.

Accept real UDID cards even when phone-OCR is noisy.
Reject chat/IDE screens that only mention Blindness/UDID.
"""

from __future__ import annotations

import io
import json
import re
from difflib import SequenceMatcher
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
)

# OCR often garbles Blindness → alindness / blndnaan / auindnet / amiadntad
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
        _reader = easyocr.Reader(["en"], gpu=use_gpu)
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
        return {
            "authenticated": False,
            "reason": "no_text",
            "message": "I could not read an ID card. Hold your Unique Disability ID card steady and fill the frame, then double tap to try again.",
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
            "message": "That does not look like a disability ID card. Point the camera at your Unique Disability ID card only, then double tap to scan again.",
            "source": source,
            "fields": {
                "udid": fields.get("udid"),
                "disability_type": fields.get("disability_type"),
                "disability_percentage": fields.get("disability_percentage"),
            },
            **base_meta,
        }

    card_ok = looks_like_udid_card(fields, full_text)
    visual_ok = is_visual_impairment(fields, full_text)
    has_udid = bool(fields.get("udid") and _looks_like_udid(fields["udid"]))

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
            "message": "I need a clear Unique Disability ID card in the frame. Double tap and keep the full card visible.",
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
            "message": "I read the ID card, but I did not find a visual impairment category such as Blindness or Low Vision. Double tap and keep Disability Type visible.",
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
        "message": "I could not fully verify the disability ID. Double tap and hold the card steadier under good light.",
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


def authenticate_udid_images(image_list: list[bytes]) -> dict[str, Any]:
    """
    Authenticate using hold-window frames.
    OCR the sharpest frame, then CLAHE / second frame if needed.
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

    if best_sharpness < 18.0:
        return {
            "authenticated": False,
            "reason": "too_blurry",
            "message": "The 2 second frames were too blurry. Hold the phone still closer to the ID card, then double tap to scan again.",
            "source": None,
            "fields": {},
            "qrFound": False,
            "ocrLines": [],
            "framesUsed": len(scored),
            "bestSharpness": round(best_sharpness, 1),
        }

    qr_text: str | None = None
    for _score, frame, _raw in scored[:2]:
        found = scan_qr(frame)
        if found:
            qr_text = found
            break

    merged: list[str] = []
    seen: set[str] = set()

    def add_lines(lines: list[str]) -> None:
        for line in lines:
            key = line.lower()
            if key not in seen:
                seen.add(key)
                merged.append(line)

    # Pass 1: sharpest frame
    add_lines(run_ocr_on_frame(scored[0][1], use_clahe=False))
    probe = _auth_result_from_text(
        qr_text,
        merged,
        frames_used=len(scored),
        best_sharpness=best_sharpness,
    )
    if probe.get("authenticated"):
        return probe

    # Pass 2: CLAHE on sharpest (helps glare / phone-of-screen)
    add_lines(run_ocr_on_frame(scored[0][1], use_clahe=True))
    probe = _auth_result_from_text(
        qr_text,
        merged,
        frames_used=len(scored),
        best_sharpness=best_sharpness,
    )
    if probe.get("authenticated"):
        return probe

    # Pass 3: second-sharpest frame if available
    if len(scored) > 1:
        add_lines(run_ocr_on_frame(scored[1][1], use_clahe=False))
        probe = _auth_result_from_text(
            qr_text,
            merged,
            frames_used=len(scored),
            best_sharpness=best_sharpness,
        )
        if probe.get("authenticated"):
            return probe

    return _auth_result_from_text(
        qr_text,
        merged,
        frames_used=len(scored),
        best_sharpness=best_sharpness,
    )
