# Drishti Detection Server (Local Laptop)

Runs `yolo26x.pt` on this PC and exposes HTTP detection for the phone app.
The model file is expected at the repository root (`..\yolo26x.pt`) or can be set with
`DRISHTI_MODEL_PATH`; weights are not included in Git. `start.ps1` also checks the
legacy OneDrive `Desktop\Drishti\yolo26x.pt` location.

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
