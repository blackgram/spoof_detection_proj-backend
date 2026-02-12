# Installing PyTorch for Silent-Face-Anti-Spoofing

## Quick Install

PyTorch is required for Silent-Face-Anti-Spoofing. Install it with:

```bash
# Make sure your virtual environment is activated
cd backend
source venv/bin/activate

# Install PyTorch (CPU version - lightweight)
pip install torch torchvision

# Or install with CUDA support if you have an NVIDIA GPU:
# Visit https://pytorch.org/get-started/locally/ for the correct command
```

## Why PyTorch is Needed

Silent-Face-Anti-Spoofing uses PyTorch to:
- Load and run the MiniFASNet models (.pth files)
- Perform inference on images
- Handle tensor operations

## After Installing

Restart your backend server. You should see:
```
✅ Silent-Face-Anti-Spoofing successfully imported from: /path/to/repo
INFO: SpoofDetectionService initialized with Silent-Face-Anti-Spoofing
```

Instead of the "No module named 'torch'" error.

## Installation Size

- **CPU version**: ~150-200 MB
- **CUDA version**: ~1-2 GB (includes GPU support)

For local development, the CPU version is usually sufficient.

