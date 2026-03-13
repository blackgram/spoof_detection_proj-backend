#!/usr/bin/env python3
"""
Reset all FIDO2 passkey data so you can re-register from scratch.

- Clears the local credentials file (when not using Firestore).
- Deletes all FIDO2 credentials from Firestore (when configured).
- Does NOT remove passkeys from the device (see instructions below).

Run from project root:  python backend/scripts/reset_passkeys.py
Or from backend:       python scripts/reset_passkeys.py

After running, restart the backend server so in-memory state is cleared.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Run from backend so app is importable
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

FIDO2_FILE = BACKEND_DIR / "data" / "fido2_credentials.json"


def clear_file_store() -> int:
    """Clear the JSON file used for in-memory FIDO2 persistence. Returns count removed."""
    if not FIDO2_FILE.exists():
        print("  (no local fido2_credentials.json)")
        return 0
    try:
        with open(FIDO2_FILE, encoding="utf-8") as f:
            data = json.load(f)
        count = len(data) if isinstance(data, dict) else 0
        FIDO2_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(FIDO2_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f)
        print(f"  Cleared {count} credential(s) from {FIDO2_FILE}")
        return count
    except Exception as e:
        print(f"  Error clearing file: {e}")
        return 0


def clear_firestore() -> int:
    """Delete all documents in the fido2_credentials collection. Returns count removed."""
    try:
        from app.db.firestore_client import get_firestore_client

        COLLECTION = "fido2_credentials"
        db = get_firestore_client()
        if db is None:
            print("  (Firestore not configured; skipping)")
            return 0
        coll = db.collection(COLLECTION)
        docs = list(coll.stream())
        for doc in docs:
            doc.reference.delete()
        print(f"  Deleted {len(docs)} credential(s) from Firestore collection '{COLLECTION}'")
        return len(docs)
    except ImportError as e:
        print(f"  (Firestore not available: {e})")
        return 0
    except Exception as e:
        print(f"  Error clearing Firestore: {e}")
        return 0


def main() -> None:
    print("Resetting FIDO2 passkey data...")
    print("\n1. Local file store (dev fallback):")
    clear_file_store()
    print("\n2. Firestore (if configured):")
    clear_firestore()
    print("\nDone. Restart your backend server so in-memory state is cleared.")
    print("\n--- Clear passkeys on your device ---")
    print("  Android: Settings → Google → Passkeys (or Security → Passkeys)")
    print("           Remove the passkey for this app's domain (e.g. your ngrok host).")
    print("  iOS:     Settings → Passwords → Passkeys → remove the entry for this app.")
    print("  App:     Optionally clear app data or reinstall to reset 'biometrics enabled' for your username.")
    print("\nThen sign in with password and re-enable biometrics to register a new passkey.")
    print()


if __name__ == "__main__":
    main()
