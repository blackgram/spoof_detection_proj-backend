# Liveliness backend

Standalone FastAPI service for **spoof detection** (Silent-Face-only), **face verification** (DeepFace ArcFace), and **Access Bank** `AccountImageCollection` reference photos. **No Firestore** — this is a copy of the ML + bank-image pieces from the main `backend/` for separate deployment.

## Silent-Face dependency (spoof detection)

Spoof detection needs **PyTorch**, the **Silent-Face-Anti-Spoofing** repo on disk (for `src/` imports), **RetinaFace** files under its `resources/detection_model/`, and **at least one `.pth`** anti-spoof checkpoint under `resources/anti_spoof_models/`. Details: [upstream `README_EN.md`](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/blob/master/README_EN.md) (training/test sections describe model placement).

Your error **`No module named 'torch'`** means PyTorch was not installed in the Python environment used to run `run.py`. Fix:

```bash
cd liveliness-backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt    # installs torch, torchvision, deepface, …
python -c "import torch; print(torch.__version__)"
```

Apple Silicon (`arm64`): the same requirements usually work via PyPI wheels; use the same commands (if you hit issues, pick the wheels from [pytorch.org](https://pytorch.org/get-started/locally/).

### Run locally — full setup

1. **Install deps** (see above) so `torch` imports.
2. **Get Silent-Face source** — either clone [Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing), or (**recommended**) run the pinned vendor script so you get a **checksum-verified** tree under `third_party/` without relying on ad-hoc clones:

   ```bash
   bash liveliness-backend/scripts/vendor-silent-face.sh
   ```

   That path is auto-discovered by `spoof_detection.py` (no `SILENT_FACE_PATH` needed if you run from `liveliness-backend/`). You can still set `SILENT_FACE_PATH` to another directory.

3. **Add model artifacts** inside that clone (upstream documents Google Drive links and filenames). You need:

   - `resources/detection_model/deploy.prototxt` and `Widerface-RetinaFace.caffemodel`
   - `resources/anti_spoof_models/*.pth` (at least one)

4. **Point the app at the repo root** (parent of `src/` and `resources/`):

   ```bash
   export SILENT_FACE_PATH="$(pwd)/Silent-Face-Anti-Spoofing"   # absolute path preferred
   ```

   Or add to `liveliness-backend/.env`:

   ```
   SILENT_FACE_PATH=/absolute/path/to/Silent-Face-Anti-Spoofing
   ```

5. **Run**:

   ```bash
   cd liveliness-backend
   source .venv/bin/activate
   python run.py
   ```

6. **Smoke test** spoof path: `curl -s -X POST http://127.0.0.1:8001/api/warmup` — should load without `RuntimeError`.

## Quick local start

After completing **Silent-Face dependency** above (PyTorch installed + repo + weights + `SILENT_FACE_PATH`):

```bash
cd liveliness-backend
source .venv/bin/activate   # create venv first: python3 -m venv .venv
pip install -r requirements.txt
python run.py
```

Default port is **8001** (monolith often uses 8000).

**Browser tester** (same origin, no CORS issues): open [http://127.0.0.1:8001/test-ui](http://127.0.0.1:8001/test-ui) or [http://127.0.0.1:8001/static/index.html](http://127.0.0.1:8001/static/index.html) after starting the server. Enter account number, upload selfie, run verify; optional spoof-only check section.

## Troubleshooting

| Symptom | What it means | What to do |
|--------|----------------|------------|
| `No module named 'torch'` | PyTorch is not installed in the **same** Python/venv as `uvicorn`. | From `liveliness-backend`: `source .venv/bin/activate` then `pip install -r requirements.txt`. Confirm with `which python` and `python -c "import torch"`. |
| `No module named 'fastapi'` right after claiming you installed deps | `pip install` **failed partway** (often **disk full**). | Free several GB (TensorFlow alone is hundreds of MB). `rm -rf .venv`, recreate venv, `pip install -r requirements.txt` again. |
| `bash: .../liveliness-backend/scripts/... No such file` | Shell cwd is already **`liveliness-backend/`**. | Use `bash scripts/vendor-silent-face.sh` instead of doubling the path. |
| Docker `exporting to image` … `input/output error` on `libnccl.so` or similar | Docker Desktop ran out of space or hit an I/O glitch while **writing layer blobs** (huge ML deps make this common). | Free host disk; Docker Desktop → **Resources** → raise **disk image size**; run `docker system prune` (removes unused data). Rebuild. The Dockerfile installs **CPU-only PyTorch** via `requirements-docker.txt` to reduce image size. |
| `[Errno -2] Name or service not known` for AccountImageCollection **in Docker**, while `nslookup` on Mac shows a **private** IP (`10.x`) and corp `Server:` | **Split DNS**: Docker was using **public DNS** (e.g. 8.8.8.8) which does not resolve internal-only names. Your Mac uses corporate DNS **`10.1.9.11`**. | Use **`compose.yaml`** (`dns:` → `DOCKER_DNS_SERVER` / default `10.1.9.11`) or `docker run ... --dns 10.1.9.11`. If still failing, uncomment **`extra_hosts`** in compose with `"api.dev.accessbankplc.com:10.111.29.226"` from `nslookup`. |

## Environment

| Variable | Purpose |
|----------|---------|
| `ACCESS_BANK_EFM_URL` | Base URL for EFM (default in `app/services/account_image.py`) |
| `ACCESS_BANK_EFM_AUTH_TOKEN` | Authorization header for AccountImageCollection |
| `DOCKER_DNS_SERVER` | (Docker Compose only, see `compose.yaml`) Corporate **nameserver** IP so the container can resolve internal hostnames. Use the `Server:` address from `nslookup api.dev.accessbankplc.com` (e.g. `10.1.9.11`). |
| `SILENT_FACE_PATH` | **Required** for spoof detection: repo root for [Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing) (with `resources/anti_spoof_models` `.pth` files). Docker: bake/mount at `/app/Silent-Face-Anti-Spoofing`. The service **will not start** spoof detection without it (no heuristic fallback). |

Optional: place a `.env` in `liveliness-backend/`; `app/config.py` loads it on startup.

## Smoke checks

```bash
curl -s http://127.0.0.1:8001/health
curl -s -X POST http://127.0.0.1:8001/api/warmup
curl -s -X POST -F "image=@/path/to/face.jpg" http://127.0.0.1:8001/api/spoof-check
```

Bank-backed KYC-style routes (multipart forms):

- `POST /api/kyc/verify` — fields: `account_no`, `selfie_image`
- `POST /api/kyc/liveness/start` — field: `subject_id` (opaque; same value must be sent to verify; response JSON still uses key `customer_id` for the same string)
- `POST /api/kyc/liveness/verify` — fields: `subject_id`, `account_no`, `session_id`, `timestamps`, `frame_0`, `frame_1`, …

## Docker

The image expects **vendored** Silent-Face at `COPY third_party/Silent-Face-Anti-Spoofing` — **no `git clone` at build time** (you control the exact tarball via [`scripts/vendor-silent-face.sh`](scripts/vendor-silent-face.sh), pinned commit + SHA-256).

**Before building**, populate the vendor tree:

```bash
bash liveliness-backend/scripts/vendor-silent-face.sh
```

Docker builds use [`requirements-docker.txt`](requirements-docker.txt): dependencies plus **CPU-only** PyTorch from PyTorch’s index (smaller image than default GPU‑bundled wheels). Local dev still uses [`requirements.txt`](requirements.txt).

```bash
cd liveliness-backend   # Dockerfile directory
docker build -t liveliness-backend .
```

Alternatively use [**compose.yaml**](compose.yaml). It configures **Docker to use corporate DNS** (default resolver `10.1.9.11` matches many internal networks; yours may differ — set `DOCKER_DNS_SERVER` in `.env` from the **`Server:` line** of `nslookup api.dev.accessbankplc.com`). Public DNS (`8.8.8.8`) **cannot** resolve hostnames that only exist on split-horizon / internal DNS (your host gets `10.111.29.226`; the container previously did not).

```bash
export ACCESS_BANK_EFM_AUTH_TOKEN=your_token
docker compose up --build
```
You **must still add** pretrained weights (`resources/detection_model/`, `resources/anti_spoof_models/*.pth`) into the vendor directory (or bake/mount resources in a downstream layer):

```dockerfile
# Example: copy models from a private tarball you control (optional layer)
COPY your-models/silent_face_resources/resources /app/Silent-Face-Anti-Spoofing/resources
```

Runtime override — mount another tree over the upstream code:

```bash
docker run --rm -p 8001:8001 \
  -v "/ABS/PATH/Silent-Face-Anti-Spoofing:/app/Silent-Face-Anti-Spoofing:ro" \
  -e ACCESS_BANK_EFM_AUTH_TOKEN=… \
  liveliness-backend
```

The `third_party/Silent-Face-Anti-Spoofing/` directory is **gitignored by default** (see [`third_party/.gitignore`](third_party/.gitignore)); it remains on disk for Docker build context.


## Notes

- Multi-instance: in-memory liveness sessions (`liveness_session.py`) are not shared across replicas; use Redis or similar in production if you scale horizontally.
- Copied from monolith `backend/`; the monolith code is unchanged.
