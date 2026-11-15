# Drishti Detection Server (Laptop GPU)

Runs `yolo26x.pt` on this PC and exposes HTTP detection for the phone app.

## 1. Install (once)

```powershell
cd C:\Users\srane\OneDrive\Desktop\Drishti\server
.\.venv\Scripts\Activate.ps1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
```

Confirm CUDA:

```powershell
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu')"
```

## 2. Start server

```powershell
cd C:\Users\srane\OneDrive\Desktop\Drishti\server
.\.venv\Scripts\Activate.ps1
$env:KMP_DUPLICATE_LIB_OK='TRUE'
python app.py
```

Server listens on **all interfaces**: `http://0.0.0.0:8765`

Your Wi‑Fi IP (phone must use this): check with `ipconfig` (example `192.168.0.108`).

Health check from PC:

```powershell
curl http://127.0.0.1:8765/health
```

## 3. Phone + firewall

1. Phone and laptop on the **same Wi‑Fi**
2. Allow port **8765** in Windows Firewall (inbound TCP)
3. In the app, server URL defaults to `http://192.168.0.108:8765` (edit in `src/core/utils/serverConfig.ts` if your IP changes)

## API

- `GET /health` — model/backend status
- `POST /detect` — multipart form field `file` (JPEG/PNG) → JSON detections
