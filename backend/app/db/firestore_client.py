"""
Firestore client for customers, accounts, and audit logs.
Uses Application Default Credentials on Cloud Run; set GOOGLE_APPLICATION_CREDENTIALS for local dev.
"""

import base64
import hashlib
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional


def _fido2_doc_id(credential_id_b64: str) -> str:
    """Firestore document IDs cannot contain '/' or '.'; standard base64 does. Use a safe hash."""
    return hashlib.sha256(credential_id_b64.encode()).hexdigest()

logger = logging.getLogger(__name__)

COLLECTION_CUSTOMERS = "customers"
SUBCOLLECTION_ACCOUNTS = "accounts"
COLLECTION_AUDIT_LOGS = "audit_logs"
COLLECTION_FIDO2_CREDENTIALS = "fido2_credentials"
COLLECTION_DEVICE_PUBLIC_KEYS = "device_public_keys"
COLLECTION_DEVICE_AUTH_EVENTS = "device_auth_events"

DEFAULT_LIMIT_NGN = 100_000
MIN_LIMIT_NGN = 100_000
MAX_LIMIT_NGN = 50_000_000

# In-memory fallback when Firestore is not configured (e.g. tests)
_memory_store: dict = {"customers": {}, "accounts": {}, "audit_logs": {}, "fido2_credentials": {}, "device_public_keys": {}, "device_auth_events": []}

# When using in-memory store, persist FIDO2 credentials to this file so they survive server restarts.
_FIDO2_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "fido2_credentials.json"
_DEVICE_KEYS_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "device_public_keys.json"
_DEVICE_AUTH_EVENTS_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "device_auth_events.json"


def _load_fido2_from_file() -> None:
    """Load FIDO2 credentials from file into _memory_store (dev fallback when Firestore not used)."""
    if not _FIDO2_FILE.exists():
        return
    try:
        with open(_FIDO2_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            _memory_store["fido2_credentials"].update(data)
            logger.info("Loaded %d FIDO2 credential(s) from %s", len(data), _FIDO2_FILE)
    except Exception as e:
        logger.warning("Could not load FIDO2 credentials from file: %s", e)


def _save_fido2_to_file() -> None:
    """Persist in-memory FIDO2 credentials to file (dev fallback)."""
    try:
        _FIDO2_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_FIDO2_FILE, "w", encoding="utf-8") as f:
            json.dump(_memory_store["fido2_credentials"], f, indent=2)
    except Exception as e:
        logger.warning("Could not save FIDO2 credentials to file: %s", e)


def _load_device_keys_from_file() -> None:
    """Load device public keys from file into _memory_store (dev fallback)."""
    if not _DEVICE_KEYS_FILE.exists():
        return
    try:
        with open(_DEVICE_KEYS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            _memory_store["device_public_keys"].update(data)
            logger.info("Loaded %d device public key(s) from %s", len(data), _DEVICE_KEYS_FILE)
    except Exception as e:
        logger.warning("Could not load device public keys from file: %s", e)


def _save_device_keys_to_file() -> None:
    """Persist in-memory device public keys to file (dev fallback)."""
    try:
        _DEVICE_KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_DEVICE_KEYS_FILE, "w", encoding="utf-8") as f:
            json.dump(_memory_store["device_public_keys"], f, indent=2)
    except Exception as e:
        logger.warning("Could not save device public keys to file: %s", e)


def _load_device_auth_events_from_file() -> None:
    """Load device auth events from file into _memory_store (dev fallback)."""
    if not _DEVICE_AUTH_EVENTS_FILE.exists():
        return
    try:
        with open(_DEVICE_AUTH_EVENTS_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            _memory_store["device_auth_events"] = data
            logger.info("Loaded %d device auth event(s) from %s", len(data), _DEVICE_AUTH_EVENTS_FILE)
    except Exception as e:
        logger.warning("Could not load device auth events from file: %s", e)


def _save_device_auth_events_to_file() -> None:
    """Persist in-memory device auth events to file (dev fallback)."""
    try:
        _DEVICE_AUTH_EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_DEVICE_AUTH_EVENTS_FILE, "w", encoding="utf-8") as f:
            json.dump(_memory_store["device_auth_events"], f, indent=2)
    except Exception as e:
        logger.warning("Could not save device auth events to file: %s", e)


# Hardcoded for local/PoC – backend/ folder
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_FIRESTORE_PROJECT_ID = "vernal-seeker-303517"
_FIRESTORE_CREDENTIALS_FILENAME = "vernal-seeker-303517-73b020321a85.json"


def _get_client():
    """Lazy-init Firestore client. Uses hardcoded project + key file in backend/."""
    import os
    try:
        from google.cloud import firestore
    except ImportError as e:
        logger.warning("Firestore not available (install google-cloud-firestore): %s", e)
        return None
    project_id = os.environ.get("FIRESTORE_PROJECT_ID") or _FIRESTORE_PROJECT_ID
    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path or not os.path.isfile(os.path.expanduser(creds_path)):
        creds_path = str(_BACKEND_DIR / _FIRESTORE_CREDENTIALS_FILENAME)
    if not os.path.isfile(creds_path):
        logger.warning("Firestore credentials file not found at %s", creds_path)
        return None
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.path.abspath(creds_path)
    try:
        client = firestore.Client(project=project_id)
        logger.info("Firestore connected (project=%s)", project_id)
        return client
    except Exception as e:
        logger.warning("Firestore client failed, using in-memory store: %s", e)
        return None


_client = None


def get_firestore_client():
    """Return Firestore client or None if not configured."""
    global _client
    if _client is None:
        _client = _get_client()
    return _client


class FirestoreClient:
    """CRUD for customers and accounts. Falls back to in-memory dict if Firestore not configured."""

    def __init__(self):
        self._db = get_firestore_client()
        self._use_memory = self._db is None
        if self._use_memory:
            logger.warning("Firestore not configured; using in-memory store.")
            _load_fido2_from_file()
            _load_device_keys_from_file()
            _load_device_auth_events_from_file()

    def _customers_ref(self):
        if self._db:
            return self._db.collection(COLLECTION_CUSTOMERS)
        return None

    def _customer_doc(self, customer_id: str):
        if self._db:
            return self._db.collection(COLLECTION_CUSTOMERS).document(customer_id)
        return None

    def _now(self) -> str:
        return datetime.utcnow().isoformat() + "Z"

    # --- Customers ---

    def create_customer(
        self,
        bvn: str,
        name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        username: Optional[str] = None,
    ) -> str:
        """Create a customer. Returns customer_id. Use bvn='' for username-only (pre-KYC) customers."""
        now = self._now()
        data = {
            "bvn": bvn or "",
            "name": name,
            "email": email or None,
            "phone": phone or None,
            "username": (username or "").strip() or None,
            "kyc_completed": False,
            "reference_image_base64": None,
            "current_limit_ngn": DEFAULT_LIMIT_NGN,
            "created_at": now,
            "updated_at": now,
        }
        if self._db:
            ref = self._customers_ref().document()
            ref.set(data)
            return ref.id
        # In-memory
        customer_id = str(uuid.uuid4())
        _memory_store["customers"][customer_id] = {**data, "id": customer_id}
        return customer_id

    def get_customer_by_username(self, username: str) -> Optional[dict]:
        """Get customer by username (unique per app). Returns None if not found."""
        key = (username or "").strip()
        if not key:
            return None
        if self._db:
            q = self._customers_ref().where("username", "==", key).limit(1).get()
            for doc in q:
                d = doc.to_dict()
                d["id"] = doc.id
                return d
            return None
        for c in _memory_store["customers"].values():
            if (c.get("username") or "").strip() == key:
                return c
        return None

    def ensure_customer_for_username(self, username: str) -> tuple[str, bool]:
        """
        Get existing customer for this username, or create one (bvn='', name=username).
        Returns (customer_id, created: True if new).
        """
        key = (username or "").strip()
        if not key:
            raise ValueError("username is required")
        existing = self.get_customer_by_username(key)
        if existing:
            return existing["id"], False
        customer_id = self.create_customer(bvn="", name=key, email=None, phone=None, username=key)
        return customer_id, True

    def update_customer_bvn_and_name(self, customer_id: str, bvn: str, name: str) -> bool:
        """Update customer's BVN and name (e.g. when completing KYC for a username-created customer)."""
        now = self._now()
        if self._db:
            ref = self._customer_doc(customer_id)
            if not ref.get().exists:
                return False
            ref.update({"bvn": bvn or "", "name": name or "", "updated_at": now})
            return True
        c = _memory_store["customers"].get(customer_id)
        if not c:
            return False
        c["bvn"] = bvn or ""
        c["name"] = name or ""
        c["updated_at"] = now
        return True

    def get_customer_limit(self, customer_id: str) -> Optional[float]:
        """Return current_limit_ngn or None if customer not found."""
        cust = self.get_customer_by_id(customer_id)
        if not cust:
            return None
        return cust.get("current_limit_ngn", DEFAULT_LIMIT_NGN)

    def update_customer_limit(self, customer_id: str, limit_ngn: float) -> bool:
        """Update current_limit_ngn. Clamps to [MIN_LIMIT_NGN, MAX_LIMIT_NGN]. Returns False if customer not found."""
        limit_ngn = max(MIN_LIMIT_NGN, min(MAX_LIMIT_NGN, limit_ngn))
        now = self._now()
        if self._db:
            ref = self._customer_doc(customer_id)
            if not ref.get().exists:
                return False
            ref.update({"current_limit_ngn": limit_ngn, "updated_at": now})
            return True
        c = _memory_store["customers"].get(customer_id)
        if not c:
            return False
        c["current_limit_ngn"] = limit_ngn
        c["updated_at"] = now
        return True

    def get_customer_by_id(self, customer_id: str) -> Optional[dict]:
        """Get customer by id. reference_image_base64 excluded from response in API layer."""
        if self._db:
            doc = self._customer_doc(customer_id).get()
            if not doc.exists:
                return None
            d = doc.to_dict()
            d["id"] = doc.id
            return d
        return _memory_store["customers"].get(customer_id)

    def get_customer_by_bvn(self, bvn: str) -> Optional[dict]:
        if self._db:
            q = self._customers_ref().where("bvn", "==", bvn).limit(1).get()
            for doc in q:
                d = doc.to_dict()
                d["id"] = doc.id
                return d
            return None
        for c in _memory_store["customers"].values():
            if c.get("bvn") == bvn:
                return c
        return None

    def update_customer_kyc_reference(self, customer_id: str, reference_image_base64: str) -> bool:
        """Store reference image and set kyc_completed=True."""
        now = self._now()
        if self._db:
            ref = self._customer_doc(customer_id)
            if not ref.get().exists:
                return False
            ref.update({
                "kyc_completed": True,
                "reference_image_base64": reference_image_base64,
                "updated_at": now,
            })
            return True
        c = _memory_store["customers"].get(customer_id)
        if not c:
            return False
        c["kyc_completed"] = True
        c["reference_image_base64"] = reference_image_base64
        c["updated_at"] = now
        return True

    def set_kyc_completed(self, customer_id: str, completed: bool = True) -> bool:
        """Set kyc_completed flag without changing reference image (e.g. for mock data)."""
        now = self._now()
        if self._db:
            ref = self._customer_doc(customer_id)
            if not ref.get().exists:
                return False
            ref.update({"kyc_completed": completed, "updated_at": now})
            return True
        c = _memory_store["customers"].get(customer_id)
        if not c:
            return False
        c["kyc_completed"] = completed
        c["updated_at"] = now
        return True

    def get_customer_reference_image(self, customer_id: str) -> Optional[bytes]:
        """Return reference image bytes for face verification. None if not found."""
        cust = self.get_customer_by_id(customer_id)
        if not cust:
            return None
        b64 = cust.get("reference_image_base64")
        if not b64:
            return None
        try:
            return base64.b64decode(b64)
        except Exception:
            return None

    def get_kyc_status(self, customer_id: str) -> Optional[dict]:
        """Returns { kyc_completed, has_reference_image }."""
        cust = self.get_customer_by_id(customer_id)
        if not cust:
            return None
        return {
            "kyc_completed": cust.get("kyc_completed", False),
            "has_reference_image": bool(cust.get("reference_image_base64")),
            "current_limit_ngn": cust.get("current_limit_ngn", DEFAULT_LIMIT_NGN),
        }

    # --- FIDO2 credentials (Passkey) ---

    def add_fido2_credential(
        self,
        customer_id: str,
        credential_id_b64: str,
        credential_data_b64: str,
        sign_count: int = 0,
        credential_id_client: Optional[str] = None,
    ) -> None:
        """Store a FIDO2 credential for a customer. credential_id_client = exact rawId from client for allowCredentials."""
        now = self._now()
        data = {
            "customer_id": customer_id,
            "credential_id_b64": credential_id_b64,
            "credential_data_b64": credential_data_b64,
            "sign_count": sign_count,
            "credential_id_client": (credential_id_client or "").strip() or None,
            "created_at": now,
            "updated_at": now,
        }
        if self._db:
            doc_id = _fido2_doc_id(credential_id_b64)
            ref = self._db.collection(COLLECTION_FIDO2_CREDENTIALS).document(doc_id)
            ref.set(data)
        else:
            _memory_store["fido2_credentials"][credential_id_b64] = {**data, "id": credential_id_b64}
            _save_fido2_to_file()

    def get_fido2_credentials(self, customer_id: str) -> list[dict]:
        """Return all stored FIDO2 credentials for a customer (includes credential_id_client when set)."""
        def _row(data: dict) -> dict:
            return {
                "credential_id_b64": data.get("credential_id_b64"),
                "credential_data_b64": data.get("credential_data_b64"),
                "sign_count": data.get("sign_count", 0),
                "credential_id_client": data.get("credential_id_client"),
            }
        if self._db:
            q = (
                self._db.collection(COLLECTION_FIDO2_CREDENTIALS)
                .where("customer_id", "==", customer_id)
                .get()
            )
            return [_row(doc.to_dict()) for doc in q]
        return [
            _row(v)
            for v in _memory_store["fido2_credentials"].values()
            if v.get("customer_id") == customer_id
        ]

    def update_fido2_sign_count(self, credential_id_b64: str, sign_count: int) -> bool:
        """Update sign_count for a credential (after successful assertion)."""
        now = self._now()
        if self._db:
            doc_id = _fido2_doc_id(credential_id_b64)
            ref = self._db.collection(COLLECTION_FIDO2_CREDENTIALS).document(doc_id)
            doc = ref.get()
            if not doc.exists:
                return False
            ref.update({"sign_count": sign_count, "updated_at": now})
            return True
        rec = _memory_store["fido2_credentials"].get(credential_id_b64)
        if not rec:
            return False
        rec["sign_count"] = sign_count
        rec["updated_at"] = now
        return True

    # --- Device public keys (Ed25519, for device-bound biometric auth) ---

    def set_device_public_key(self, customer_id: str, public_key_b64: str, algorithm: str = "ed25519") -> None:
        """Store or replace the device public key for a customer (one key per customer)."""
        now = self._now()
        data = {
            "customer_id": customer_id,
            "public_key_b64": public_key_b64,
            "algorithm": algorithm,
            "created_at": now,
            "updated_at": now,
        }
        if self._db:
            ref = self._db.collection(COLLECTION_DEVICE_PUBLIC_KEYS).document(customer_id)
            ref.set(data)
        else:
            _memory_store["device_public_keys"][customer_id] = data
            _save_device_keys_to_file()

    def get_device_public_key(self, customer_id: str) -> Optional[dict]:
        """Return stored device public key for customer, or None."""
        if self._db:
            ref = self._db.collection(COLLECTION_DEVICE_PUBLIC_KEYS).document(customer_id)
            doc = ref.get()
            if not doc.exists:
                return None
            return doc.to_dict()
        return _memory_store["device_public_keys"].get(customer_id)

    def add_device_auth_event(
        self,
        customer_id: str,
        event_type: str,
        challenge_b64: str,
        signature_b64: str,
        device_name: Optional[str] = None,
        amount_ngn: Optional[float] = None,
        beneficiary_account_number: Optional[str] = None,
        state_id: Optional[str] = None,
    ) -> None:
        """Append a device-auth event (login or transaction) for audit. Stores challenge, signature, device name."""
        now = self._now()
        data = {
            "customer_id": customer_id,
            "event_type": event_type,
            "challenge_b64": challenge_b64,
            "signature_b64": signature_b64,
            "device_name": device_name or "",
            "created_at": now,
        }
        if amount_ngn is not None:
            data["amount_ngn"] = amount_ngn
        if beneficiary_account_number is not None:
            data["beneficiary_account_number"] = beneficiary_account_number
        if state_id is not None:
            data["state_id"] = state_id
        if self._db:
            ref = self._db.collection(COLLECTION_DEVICE_AUTH_EVENTS).document()
            ref.set(data)
        else:
            data["id"] = str(uuid.uuid4())
            _memory_store["device_auth_events"].append(data)
            _save_device_auth_events_to_file()

    # --- Accounts (subcollection under customer) ---

    def add_account(self, customer_id: str, account_number: str, account_type: str = "current", balance_ngn: float = 0.0) -> Optional[str]:
        now = self._now()
        data = {
            "account_number": account_number,
            "account_type": account_type,
            "balance_ngn": balance_ngn,
            "status": "active",
            "created_at": now,
            "updated_at": now,
        }
        if self._db:
            ref = self._customer_doc(customer_id).collection(SUBCOLLECTION_ACCOUNTS).document()
            ref.set(data)
            return ref.id
        acc_id = str(uuid.uuid4())
        _memory_store["accounts"][acc_id] = {**data, "id": acc_id, "customer_id": customer_id}
        return acc_id

    def get_accounts(self, customer_id: str) -> list:
        if self._db:
            docs = self._customer_doc(customer_id).collection(SUBCOLLECTION_ACCOUNTS).get()
            return [{"id": d.id, **d.to_dict()} for d in docs]
        return [a for a in _memory_store["accounts"].values() if a.get("customer_id") == customer_id]

    def update_balance(self, customer_id: str, account_id: str, balance_ngn: float) -> bool:
        now = self._now()
        if self._db:
            ref = self._customer_doc(customer_id).collection(SUBCOLLECTION_ACCOUNTS).document(account_id)
            if not ref.get().exists:
                return False
            ref.update({"balance_ngn": balance_ngn, "updated_at": now})
            return True
        for a in _memory_store["accounts"].values():
            if a.get("customer_id") == customer_id and a.get("id") == account_id:
                a["balance_ngn"] = balance_ngn
                a["updated_at"] = now
                return True
        return False

    def get_account_by_account_number(self, account_number: str) -> Optional[dict]:
        """Find account by account_number (any customer). Returns dict with id, customer_id, account_number, balance_ngn, etc.
        Uses customer iteration to avoid requiring a Firestore collection group index.
        """
        if self._db:
            for customer_doc in self._customers_ref().stream():
                customer_id = customer_doc.id
                accounts = self.get_accounts(customer_id)
                for acc in accounts:
                    if acc.get("account_number") == account_number:
                        return {**acc, "customer_id": customer_id}
            return None
        for a in _memory_store["accounts"].values():
            if a.get("account_number") == account_number:
                return dict(a)
        return None

    def add_audit_log(self, entry: dict[str, Any]) -> str:
        """Append an audit log entry. Returns document/record id."""
        now = self._now()
        record = {**entry, "timestamp": entry.get("timestamp") or now}
        if self._db:
            ref = self._db.collection(COLLECTION_AUDIT_LOGS).document()
            ref.set(record)
            return ref.id
        log_id = str(uuid.uuid4())
        _memory_store["audit_logs"][log_id] = {**record, "id": log_id}
        return log_id

    def execute_transfer(
        self,
        sender_customer_id: str,
        sender_account_id: str,
        beneficiary_account_number: str,
        amount_ngn: float,
        audit_payload: dict[str, Any],
        client_ip: Optional[str] = None,
    ) -> str:
        """
        Debit sender account, credit beneficiary account, write audit log.
        Both sender and beneficiary must be KYC verified.
        Returns transaction_id (audit log id).
        """
        if amount_ngn <= 0:
            raise ValueError("Amount must be positive")
        sender_cust = self.get_customer_by_id(sender_customer_id)
        if not sender_cust:
            raise ValueError("Sender customer not found")
        if not sender_cust.get("kyc_completed"):
            raise ValueError("Sender must be KYC verified to transfer")
        sender_accounts = self.get_accounts(sender_customer_id)
        sender_acc = next((a for a in sender_accounts if a["id"] == sender_account_id), None)
        if not sender_acc:
            raise ValueError("Sender account not found")
        sender_balance = sender_acc.get("balance_ngn", 0.0)
        if sender_balance < amount_ngn:
            raise ValueError("Insufficient balance")
        limit = self.get_customer_limit(sender_customer_id) or DEFAULT_LIMIT_NGN
        if amount_ngn > limit:
            raise ValueError("Amount exceeds your transfer limit")
        beneficiary = self.get_account_by_account_number(beneficiary_account_number)
        if not beneficiary:
            raise ValueError("Beneficiary account not found")
        beneficiary_customer_id = beneficiary["customer_id"]
        beneficiary_cust = self.get_customer_by_id(beneficiary_customer_id)
        if not beneficiary_cust or not beneficiary_cust.get("kyc_completed"):
            raise ValueError("Beneficiary must be KYC verified to receive transfers")
        if beneficiary_customer_id == sender_customer_id and beneficiary.get("id") == sender_account_id:
            raise ValueError("Cannot transfer to the same account")
        beneficiary_balance = beneficiary.get("balance_ngn", 0.0)
        new_sender_balance = sender_balance - amount_ngn
        new_beneficiary_balance = beneficiary_balance + amount_ngn
        transaction_id = str(uuid.uuid4())
        now = self._now()
        audit_entry = {
            "transaction_id": transaction_id,
            "user_id": audit_payload.get("user_id", ""),
            "device_id": audit_payload.get("device_id", ""),
            "public_key_id": audit_payload.get("public_key_id", ""),
            "nonce": audit_payload.get("nonce", ""),
            "transaction_hash": audit_payload.get("transaction_hash", ""),
            "digital_signature": audit_payload.get("digital_signature", ""),
            "biometric_modality": audit_payload.get("biometric_modality", "FACE"),
            "timestamp": now,
            "risk_score": audit_payload.get("risk_score"),
            "ip_address": client_ip or audit_payload.get("ip_address", ""),
            "sender_customer_id": sender_customer_id,
            "beneficiary_customer_id": beneficiary_customer_id,
            "amount_ngn": amount_ngn,
        }
        self.update_balance(sender_customer_id, sender_account_id, new_sender_balance)
        self.update_balance(beneficiary_customer_id, beneficiary["id"], new_beneficiary_balance)
        self.add_audit_log(audit_entry)
        return transaction_id

    def seed_mock_customers_if_empty(self) -> int:
        """
        If no customers exist, create mock KYC-verified customers with accounts and balances.
        Returns number of customers created (0 if already had data).
        """
        if self._db:
            existing = self._customers_ref().limit(1).get()
            if len(list(existing)) > 0:
                return 0
        else:
            if _memory_store["customers"]:
                return 0
        mock_customers = [
            {"bvn": "11111111111", "name": "Alice Demo", "account_number": "1111222233", "balance_ngn": 1_000_000},
            {"bvn": "22222222222", "name": "Bob Demo", "account_number": "2222333344", "balance_ngn": 500_000},
            {"bvn": "33333333333", "name": "Carol Demo", "account_number": "3333444455", "balance_ngn": 750_000},
        ]
        created = 0
        for m in mock_customers:
            cid = self.create_customer(bvn=m["bvn"], name=m["name"], email=None, phone=None)
            self.set_kyc_completed(cid, True)  # Mock: KYC verified without stored face image
            self.add_account(cid, m["account_number"], "current", m["balance_ngn"])
            created += 1
        logger.info("Seeded %d mock KYC-verified customers with accounts", created)
        return created
