# Drishti Detection Server (Local Laptop)

Runs `yolo26x.pt` on this PC and exposes HTTP detection for the phone app. When
`yolov8s-worldv2.pt` is available, a second local model adds detections for
household items that are not in COCO, including cabinets, TV stands, idols,
remote controls, buckets, boxes, and clothes-drying racks. Both models run
locally; no image is sent to a cloud inference service.
Live inference uses 640px input and a 0.10 confidence threshold to retain more
small and distant objects; expect some additional false positives.
The model file is expected at the repository root (`..\yolo26x.pt`) or can be set with
`DRISHTI_MODEL_PATH`; weights are not included in Git. `start.ps1` also checks the
legacy OneDrive `Desktop\Drishti\yolo26x.pt` location.
The optional YOLO-World weights are expected at the repository root or can be
set with `DRISHTI_WORLD_MODEL_PATH`. Download them once from the official
Ultralytics asset release by running this from the repository root after installing
the server dependencies:

```powershell
python -c "from ultralytics import YOLOWorld; YOLOWorld('yolov8s-worldv2.pt')"
```

The server applies higher, class-specific confidence thresholds to these extra
labels. Distance and step counts are still approximate estimates, not a safety
guarantee; the 21 supplied room photos are not enough to certify general accuracy.

## 1. Install (once)

```powershell
cd C:\Users\srane\Aankhbanadi\server
.\.venv\Scripts\Activate.ps1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
```

EasyOCR and all image-processing dependencies are installed by `requirements.txt`.
The server uses CUDA when available and falls back to CPU for OCR.

Confirm CUDA:

```powershell
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu')"
```

## 2. Start server

```powershell
cd C:\Users\srane\Aankhbanadi\server
.\start.ps1
```

Server listens on **all interfaces**: `http://0.0.0.0:8765`

Your Wi‑Fi IP (phone must use this): check with `ipconfig`. The phone and laptop
must share Wi-Fi, and the address in `c_app/src/core/utils/serverConfig.ts`
must match the laptop's current Wi-Fi IPv4 address.

Health check from PC:

```powershell
curl http://127.0.0.1:8765/health
```

## 3. Phone + firewall

1. Phone and laptop on the **same Wi‑Fi**
2. Allow port **8765** in Windows Firewall (inbound TCP)
3. The app defaults to `http://192.168.1.10:8765`; update `c_app/src/core/utils/serverConfig.ts` and rebuild the APK if the laptop IP changes.

## API

- `GET /health` — model/backend status
- `POST /detect` — multipart form field `file` (JPEG/PNG) → JSON detections
