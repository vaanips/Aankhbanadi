"""
Drishti GPU server:
- YOLO detection for live assistance
- UDID auth via QR + EasyOCR
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from detection_engine import engine
from udid_auth import authenticate_udid_images, get_reader

app = FastAPI(title="Drishti Detection Server", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Saved for offline testing / debugging of UDID scans
UDID_SCAN_DIR = Path(__file__).resolve().parent / "udid_scans"

_meta: dict[str, Any] = {}
_ocr_ready = False


def _save_udid_scan_burst(
    images: list[bytes],
    result: dict[str, Any],
) -> dict[str, Any]:
    """Persist every hold-window frame + one result JSON under server/udid_scans/."""
    UDID_SCAN_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    status = "ok" if result.get("authenticated") else "fail"
    reason = str(result.get("reason") or "unknown")[:40].replace(" ", "_")
    stem = f"{stamp}_{status}_{reason}"
    image_files: list[str] = []
    for index, image_bytes in enumerate(images):
        name = f"{stem}_f{index:02d}.jpg"
        path = UDID_SCAN_DIR / name
        path.write_bytes(image_bytes)
        image_files.append(name)
        print(f"Saved UDID scan frame: {path}", flush=True)
    meta_path = UDID_SCAN_DIR / f"{stem}.json"
    payload = {
        **result,
        "savedAt": stamp,
        "imageFiles": image_files,
        "imageFile": image_files[0] if image_files else None,
    }
    meta_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return {
        "imageFiles": image_files,
        "metaFile": meta_path.name,
        "dir": str(UDID_SCAN_DIR),
    }


@app.on_event("startup")
def startup() -> None:
    global _meta, _ocr_ready
    UDID_SCAN_DIR.mkdir(parents=True, exist_ok=True)
    _meta = engine.load()
    print("Drishti detection server ready:", _meta, flush=True)
    print(f"UDID scans folder: {UDID_SCAN_DIR}", flush=True)
    try:
        get_reader()
        _ocr_ready = True
        print("EasyOCR ready for UDID authentication.", flush=True)
    except Exception as exc:  # noqa: BLE001
        _ocr_ready = False
        print("EasyOCR failed to load:", exc, flush=True)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "ready": engine.model is not None,
        "ocrReady": _ocr_ready,
        "udidScanDir": str(UDID_SCAN_DIR),
        **_meta,
    }


@app.post("/detect")
async def detect(file: UploadFile = File(...)) -> dict[str, Any]:
    if engine.model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image")

    started = time.perf_counter()
    try:
        detections = engine.detect_bytes(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc

    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    return {
        "detections": detections,
        "count": len(detections),
        "inferenceMs": elapsed_ms,
        "backend": _meta.get("backend"),
        "demoMode": False,
    }


@app.post("/auth/udid")
async def auth_udid(
    files: list[UploadFile] | None = File(None),
    file: UploadFile | None = File(None),
) -> dict[str, Any]:
    """
    Authenticate disability ID frames captured during the 2s hold.
    Accepts multiple `files` (preferred) or a single `file`.
    QR preferred when present; EasyOCR always runs and is required if QR is missing.
    """
    if not _ocr_ready:
        try:
            get_reader()
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=503,
                detail=f"OCR service unavailable: {exc}",
            ) from exc

    uploads: list[UploadFile] = []
    if files:
        uploads.extend(files)
    if file is not None:
        uploads.append(file)

    if not uploads:
        raise HTTPException(status_code=400, detail="No ID frames uploaded")

    frames: list[bytes] = []
    for upload in uploads:
        raw = await upload.read()
        if raw:
            frames.append(raw)

    if not frames:
        raise HTTPException(status_code=400, detail="Empty ID frames")

    started = time.perf_counter()
    try:
        result = authenticate_udid_images(frames)
    except ValueError as exc:
        try:
            _save_udid_scan_burst(
                frames,
                {
                    "authenticated": False,
                    "reason": "decode_error",
                    "message": str(exc),
                },
            )
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        try:
            _save_udid_scan_burst(
                frames,
                {
                    "authenticated": False,
                    "reason": "auth_exception",
                    "message": str(exc),
                },
            )
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(status_code=500, detail=f"Auth failed: {exc}") from exc

    result["processingMs"] = round((time.perf_counter() - started) * 1000, 1)
    try:
        saved = _save_udid_scan_burst(frames, result)
        result["savedScan"] = saved
    except Exception as exc:  # noqa: BLE001
        print(f"Failed to save UDID scan: {exc}", flush=True)
        result["savedScan"] = None
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8765,
        reload=False,
    )
