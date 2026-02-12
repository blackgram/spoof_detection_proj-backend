# Installing Silent-Face-Anti-Spoofing

This guide will help you install Silent-Face-Anti-Spoofing for proper spoof detection.

## Quick Install

```bash
# From the backend directory
cd backend

# Clone the repository
git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing.git ../Silent-Face-Anti-Spoofing

# Download model files (you'll need to do this manually from their releases)
# Or use their download script if available
```

## Step-by-Step Installation

### 1. Clone the Repository

```bash
# Go to project root or a suitable location
cd /Users/applemacbook/Projects/Access/spoof_detection_proj
git clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing.git
```

### 2. Install Dependencies

```bash
cd Silent-Face-Anti-Spoofing
pip install -r requirements.txt
```

### 3. Download Model Files

The model files need to be downloaded from their GitHub releases:

**Option A: Manual Download**
1. Visit: https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/releases
2. Download the model files (usually `.pth` files)
3. Place them in `Silent-Face-Anti-Spoofing/resources/anti_spoof/`

**Option B: Use their download script (if available)**
```bash
# Check if they have a download script
python scripts/download_models.py  # or similar
```

### 4. Update Backend Code

Update the import path in `backend/app/services/spoof_detection.py`:

```python
# Update the import to point to the cloned repo
import sys
sys.path.append('/Users/applemacbook/Projects/Access/spoof_detection_proj/Silent-Face-Anti-Spoofing/src')

from src.anti_spoof_predict import AntiSpoofPredict
from src.generate_patches import CropImage
```

### 5. Update Model Directory

Update the model directory path in `SpoofDetectionService.__init__()`:

```python
def __init__(self, model_dir: str = "/path/to/Silent-Face-Anti-Spoofing/resources/anti_spoof"):
    ...
```

## Alternative: Install as Package

If the repo supports pip installation:

```bash
pip install git+https://github.com/minivision-ai/Silent-Face-Anti-Spoofing.git
```

However, this may not work if they don't have proper package setup.

## Verification

After installation, restart your backend server. You should see:

```
INFO:app.services.spoof_detection:SpoofDetectionService initialized with Silent-Face-Anti-Spoofing
```

Instead of:

```
WARNING: Silent-Face-Anti-Spoofing not available
```

## Troubleshooting

### Import Errors

If you get import errors, make sure:
1. The repository is cloned correctly
2. The path in `sys.path.append()` is correct
3. All dependencies are installed

### Model Not Found

If you get "model not found" errors:
1. Check that model files are in the correct directory
2. Verify the `model_dir` path in the service
3. Check model file names match what the code expects

### Still Using Basic Detection

If it still says "basic detection":
1. Check the import succeeded (no exceptions on startup)
2. Verify the `use_silent_face` flag is `True`
3. Check logs for initialization errors

## Model Files Needed

Typically you need:
- `2.7_80x80_MiniFASNetV2.pth` (lightweight, ~2.7 MB)
- `4.4_80x80_MiniFASNetV1SE.pth` (~4.4 MB)

Or other model files from their releases page.

