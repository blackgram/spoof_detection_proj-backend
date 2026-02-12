# ⚠️ Python Version Compatibility Issue

## Problem

You're using **Python 3.14.2**, but **TensorFlow** (required by DeepFace) doesn't support Python 3.14 yet.

TensorFlow currently supports Python **3.9 - 3.12**.

## Solution: Use Python 3.11 or 3.12

### Option 1: Install Python 3.12 (Recommended)

#### Using Homebrew (macOS):
```bash
# Install Python 3.12
brew install python@3.12

# Create virtual environment with Python 3.12
python3.12 -m venv venv

# Activate it
source venv/bin/activate

# Verify version
python --version  # Should show Python 3.12.x

# Install dependencies
pip install -r requirements.txt
```

#### Using pyenv (if you have it):
```bash
# Install Python 3.12
pyenv install 3.12.7

# Set it for this project
pyenv local 3.12.7

# Create virtual environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Option 2: Use Python 3.11

Same steps as above, but use `python3.11` instead of `python3.12`.

## Quick Fix Steps

1. **Remove current venv:**
   ```bash
   rm -rf venv
   ```

2. **Create new venv with Python 3.12:**
   ```bash
   python3.12 -m venv venv
   # OR if you don't have 3.12:
   python3.11 -m venv venv
   ```

3. **Activate and install:**
   ```bash
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

## Check Available Python Versions

```bash
# List available Python versions
ls -la /usr/local/bin/python*  # Homebrew installations
# OR
which -a python3
python3 --version
```

## Recommended Python Version

- **Python 3.11** or **3.12** (both work great with TensorFlow and DeepFace)
- Python 3.14 is too new and not yet supported by TensorFlow

