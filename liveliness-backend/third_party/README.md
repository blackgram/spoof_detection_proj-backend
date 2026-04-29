## Third-party: Silent-Face-Anti-Spoofing

The Docker image and local `SILENT_FACE_PATH` expect this layout:

```
third_party/Silent-Face-Anti-Spoofing/
  src/
  resources/
  ...
```

Do **not** fetch it at image build time with `git clone` (supply-chain and repeatability risks). Populate **before** `docker build` using one of:

### A — Vendor script (pinned commit + checksum)

From the repo root:

```bash
bash liveliness-backend/scripts/vendor-silent-face.sh
```

This downloads a **specific** GitHub archive, verifies SHA-256, and extracts under `third_party/Silent-Face-Anti-Spoofing`. To bump Silent-Face, edit `COMMIT` and `EXPECTED_SHA256` at the top of `scripts/vendor-silent-face.sh` (recompute the hash locally after verifying the tarball yourself).

This directory is typically **gitignored** (see `.gitignore` in `third_party`). Files still exist on disk so `docker build` includes them unless excluded by `.dockerignore`.

### B — Git submodule (pinned commit)

Add the upstream repo as a submodule at `third_party/Silent-Face-Anti-Spoofing` and check out a fixed commit — same path the Dockerfile expects.

### Weights

Large `.pth` / caffe models are documented upstream; commit them separately or mount/copy at deploy time (`resources/detection_model/`, `resources/anti_spoof_models/`).

License / attribution: see upstream `LICENSE`.
