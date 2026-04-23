# API Endpoints: JSON Payloads and Responses

This file inventories exposed endpoints in this project:
- Backend API endpoints (`@backend/`)
- Keycloak endpoints used by the project

Notes:
- For multipart/form-data endpoints (image upload), payloads are shown as JSON-like examples for readability, but actual requests are multipart.
- Error responses are representative and may vary by FastAPI/Keycloak internals.

## Backend Endpoints (`@backend/`)

Base URL example: `http://localhost:8000`


PYTHON REQUIRED ENDPOINTS FOR AI MODEL USAGE

### `POST /api/warmup`
**Description:** Preload ML models.

**Request payload**
```json
{}
```

**Success response**
```json
{
  "status": "ready",
  "message": "Models loaded",
  "elapsed_sec": 83.4
}
```

---

### `GET /.well-known/assetlinks.json`
**Description:** Android asset links for passkeys.

**Request payload**
```json
{}
```

**Success response**
```json
[
  {
    "relation": [
      "delegate_permission/common.get_login_creds",
      "delegate_permission/common.handle_all_urls"
    ],
    "target": {
      "namespace": "android_app",
      "package_name": "com.blackgram.spoofdetectionmobile",
      "sha256_cert_fingerprints": [
        "AB:CD:EF:12:34:..."
      ]
    }
  }
]
```

---

### `GET /.well-known/apple-app-site-association`
**Description:** iOS associated domains for passkeys.

**Request payload**
```json
{}
```

**Success response**
```json
{
  "webcredentials": {
    "apps": [
      "TEAMID.com.blackgram.spoofdetectionmobile"
    ]
  }
}
```

---

### `POST /api/verify` (multipart/form-data)
**Description:** Combined spoof + face verification.

**Request payload (JSON-like)**
```json
{
  "id_image": "<binary image file>",
  "selfie_image": "<binary image file>"
}
```

**Success response**
```json
{
  "liveness_check": {
    "is_real": true,
    "confidence": 0.98
  },
  "face_verification": {
    "verified": true,
    "confidence": 0.93,
    "distance": 0.24
  },
  "overall_result": "pass",
  "message": "Identity verified successfully. Face matches and liveness check passed."
}
```

**Possible spoof response**
```json
{
  "liveness_check": {
    "is_real": false,
    "confidence": 0.99
  },
  "face_verification": {
    "verified": false,
    "confidence": 0.0,
    "distance": 1.0
  },
  "overall_result": "spoof_detected",
  "message": "Spoof detected. The selfie appears to be fake (printed photo or screen replay)."
}
```

---

### `POST /api/spoof-check` (multipart/form-data)
**Description:** Spoof detection only.

**Request payload (JSON-like)**
```json
{
  "image": "<binary image file>"
}
```

**Success response**
```json
{
  "is_real": true,
  "confidence": 0.97,
  "message": "Real"
}
```

---

### `POST /api/face-verify` (multipart/form-data)
**Description:** Face verification only (1:1).

**Request payload (JSON-like)**
```json
{
  "image1": "<binary image file>",
  "image2": "<binary image file>"
}
```

**Success response**
```json
{
  "verified": false,
  "confidence": 0.41,
  "distance": 0.62,
  "message": "Faces do not match"
}
```


KYC ENDPOINTS NEEDED ON MIDDLEWARE to be integrated with NIBSS for BVN data

## KYC (`/api/kyc`)

### `POST /api/kyc/onboard` (multipart/form-data)
**Description:** Store reference image and mark KYC complete.

**Request payload (JSON-like)**
```json
{
  "bvn": "12345678901",
  "customer_id": "cust_abc123",
  "name": "Jane Doe",
  "reference_image": "<binary image file>"
}
```

**Success response**
```json
{
  "customer_id": "cust_abc123",
  "kyc_completed": true,
  "message": "KYC onboarding successful."
}
```

---

### `POST /api/kyc/verify` (multipart/form-data)
**Description:** Verify selfie against stored KYC reference.

**Request payload (JSON-like)**
```json
{
  "customer_id": "cust_abc123",
  "selfie_image": "<binary image file>"
}
```

**Success response**
```json
{
  "liveness_check": {
    "is_real": true,
    "confidence": 0.96
  },
  "face_verification": {
    "verified": true,
    "confidence": 0.91,
    "distance": 0.27
  },
  "overall_result": "pass",
  "message": "Identity verified successfully. Face matches and liveness check passed."
}
```

---

KEYCLOAK MIDDLEWARE ENDPOINTS

## TOTP (`/api/totp`)

### `POST /api/totp/setup`
**Description:** Provision TOTP through Keycloak.

**Request payload**
```json
{
  "customer_id": "cust_abc123",
  "username": "jane.doe",
  "issuer": "AccessMore"
}
```

**Success response**
```json
{
  "success": true,
  "totp_secret": "JBSWY3DPEHPK3PXP",
  "qr_code_url": "otpauth://totp/AccessMore:jane.doe?secret=JBSWY3DPEHPK3PXP&issuer=AccessMore&algorithm=SHA1&digits=6&period=30",
  "manual_entry_key": "JBSWY3DPEHPK3PXP",
  "keycloak_user_id": "7db6f0a8-1111-2222-3333-1f245b3f99f0",
  "message": "TOTP registered successfully"
}
```

---

### `POST /api/totp/verify`
**Description:** Verify TOTP code in Keycloak.

**Request payload**
```json
{
  "customer_id": "cust_abc123",
  "username": "jane.doe",
  "totp_code": "123456"
}
```

**Success response**
```json
{
  "valid": true,
  "message": "TOTP is valid",
  "keycloak_user_id": "7db6f0a8-1111-2222-3333-1f245b3f99f0"
}
```

---

## Push Auth (`/api/push-auth`)

### `POST /api/push-auth/request`
**Description:** Create auth request and push notification.

**Request payload**
```json
{
  "customer_id": "cust_abc123",
  "request_type": "transfer",
  "channel": "ibank-web",
  "details": {
    "amount_ngn": 25000,
    "beneficiary_account_number": "9009876543"
  },
  "expires_in_seconds": 300
}
```

**Success response**
```json
{
  "request_id": "req_001",
  "status": "pending",
  "request_type": "transfer",
  "channel": "ibank-web",
  "details": {
    "amount_ngn": 25000,
    "beneficiary_account_number": "9009876543"
  },
  "created_at": "2026-04-17T10:00:00Z",
  "expires_at": "2026-04-17T10:05:00Z",
  "push_sent": true
}
```

---

### `GET /api/push-auth/pending/{customer_id}`
**Description:** List pending authorization requests.

**Request payload**
```json
{}
```

**Success response**
```json
[
  {
    "request_id": "req_001",
    "status": "pending",
    "request_type": "transfer",
    "channel": "ibank-web",
    "details": {
      "amount_ngn": 25000
    },
    "created_at": "2026-04-17T10:00:00Z",
    "expires_at": "2026-04-17T10:05:00Z",
    "push_sent": false
  }
]
```

---

### `GET /api/push-auth/request/{request_id}`
**Description:** Get one authorization request.

**Request payload**
```json
{}
```

**Success response**
```json
{
  "request_id": "req_001",
  "status": "pending",
  "request_type": "transfer",
  "channel": "ibank-web",
  "details": {
    "amount_ngn": 25000
  },
  "created_at": "2026-04-17T10:00:00Z",
  "expires_at": "2026-04-17T10:05:00Z",
  "push_sent": false
}
```

---

### `POST /api/push-auth/respond`
**Description:** Approve or reject authorization request.

**Request payload**
```json
{
  "request_id": "req_001",
  "customer_id": "cust_abc123",
  "action": "approve"
}
```

**Success response**
```json
{
  "success": true,
  "request_id": "req_001",
  "status": "approved"
}
```

---

### `POST /api/push-auth/register-token`
**Description:** Register Expo push token.

**Request payload**
```json
{
  "customer_id": "cust_abc123",
  "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Success response**
```json
{
  "registered": true,
  "customer_id": "cust_abc123"
}
```

---

## Transactions (`/api/transactions`)

### `POST /api/transactions/transfer`
**Description:** Execute transfer (optionally with authorized `state_id`).

**Request payload**
```json
{
  "sender_customer_id": "cust_abc123",
  "beneficiary_account_number": "9009876543",
  "amount_ngn": 25000,
  "audit": {
    "user_id": "cust_abc123",
    "device_id": "device-123",
    "public_key_id": "credential-id",
    "nonce": "f4ad9a4c73c84b5ba36f7f7509f12d13",
    "transaction_hash": "base64-or-hex-hash",
    "digital_signature": "base64-signature",
    "biometric_modality": "FACE",
    "risk_score": 0.15
  },
  "state_id": "w5v5j-u-I3Q0f9...token..."
}
```

**Success response**
```json
{
  "transaction_id": "txn_001",
  "amount_ngn": 25000,
  "beneficiary_account_number": "9009876543",
  "message": "Transfer successful"
}
```

---

## Keycloak Endpoints Used by Project (External)

Base URL example: `http://localhost:8080`

---

### `POST /realms/master/protocol/openid-connect/token`
**Description:** Obtain admin access token.

**Request payload (form-encoded represented as JSON)**
```json
{
  "grant_type": "password",
  "client_id": "admin-cli",
  "username": "admin",
  "password": "admin"
}
```

**Success response (example)**
```json
{
  "access_token": "eyJ...",
  "expires_in": 60,
  "refresh_expires_in": 1800,
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "not-before-policy": 0,
  "session_state": "uuid",
  "scope": "profile email"
}
```

---

### `GET /admin/realms/{realm}/users?username={username}&exact=true`
**Description:** Search for user by username.

**Request payload**
```json
{}
```

**Success response**
```json
[
  {
    "id": "7db6f0a8-1111-2222-3333-1f245b3f99f0",
    "username": "jane.doe",
    "enabled": true,
    "attributes": {
      "customer_id": [
        "cust_abc123"
      ]
    }
  }
]
```

---

### `POST /admin/realms/{realm}/users`
**Description:** Create user.

**Request payload**
```json
{
  "username": "jane.doe",
  "enabled": true,
  "attributes": {
    "customer_id": [
      "cust_abc123"
    ]
  }
}
```

**Success response**
```json
{
  "status": 201,
  "location": "/admin/realms/master/users/7db6f0a8-1111-2222-3333-1f245b3f99f0"
}
```

---

### `POST /realms/{realm}/totp-registration/totp/register`
**Description:** Register/provision TOTP.

**Request payload**
```json
{
  "userId": "7db6f0a8-1111-2222-3333-1f245b3f99f0",
  "userLabel": "AccessMore (jane.doe)"
}
```

**Success response (example)**
```json
{
  "success": true,
  "message": "TOTP registered successfully",
  "totpSecret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "otpauth://totp/...",
  "manualEntryKey": "JBSWY3DPEHPK3PXP"
}
```

---

### `POST /realms/{realm}/totp-registration/totp/verify`
**Description:** Verify TOTP code.

**Request payload**
```json
{
  "userId": "7db6f0a8-1111-2222-3333-1f245b3f99f0",
  "totpCode": "123456"
}
```

**Success response**
```json
{
  "valid": true,
  "message": "TOTP is valid"
}
```

---

### `GET /realms/{realm}/totp-registration/totp/{userId}/status`
**Description:** Get TOTP status.

**Request payload**
```json
{}
```

**Success response**
```json
{
  "userId": "7db6f0a8-1111-2222-3333-1f245b3f99f0",
  "hasTotp": true,
  "totpEnabled": true
}
```

---

### `DELETE /realms/{realm}/totp-registration/totp/{userId}`
**Description:** Remove/reset TOTP for user.

**Request payload**
```json
{}
```

**Success response**
```json
{
  "message": "TOTP removed"
}
```

---

## Common Error Response Examples

### Backend validation error
```json
{
  "detail": "username is required"
}
```

### Backend auth/signature error
```json
{
  "detail": "Signature verification failed"
}
```

### Keycloak bridge failure
```json
{
  "detail": "TOTP verification on Keycloak failed"
}
```





POC ONLY USED ENDPOINT

---

## Customers (`/api/customers`)

### `POST /api/customers`
**Description:** Create customer (idempotent by BVN).

**Request payload**
```json
{
  "bvn": "12345678901",
  "name": "Jane Doe",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "+2348000000000"
}
```

**Success response**
```json
{
  "id": "cust_abc123",
  "bvn": "12345678901",
  "name": "Jane Doe",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "+2348000000000",
  "kyc_completed": false,
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:00:00Z"
}
```

---

### `POST /api/customers/ensure-by-username`
**Description:** Ensure backend customer exists for username.

**Request payload**
```json
{
  "username": "jane.doe"
}
```

**Success response**
```json
{
  "customer_id": "cust_abc123",
  "created": true,
  "username": "jane.doe",
  "name": "jane.doe",
  "first_name": null,
  "last_name": null
}
```

---

### `POST /api/customers/register`
**Description:** Register app user with account number.

**Request payload**
```json
{
  "account_number": "9001234567",
  "phone": "+2348000000000",
  "username": "jane.doe",
  "password": "StrongPass123!",
  "first_name": "Jane",
  "last_name": "Doe"
}
```

**Success response**
```json
{
  "customer_id": "cust_abc123",
  "username": "jane.doe",
  "account_number": "9001234567"
}
```

---

### `POST /api/customers/login`
**Description:** Resolve customer by username.

**Request payload**
```json
{
  "username": "jane.doe",
  "password": "ignored-in-poc"
}
```

**Success response**
```json
{
  "customer_id": "cust_abc123",
  "username": "jane.doe",
  "name": "Jane Doe",
  "first_name": "Jane",
  "last_name": "Doe",
  "accounts": [
    {
      "id": "acct_001",
      "customer_id": "cust_abc123",
      "account_number": "9001234567",
      "account_type": "current",
      "balance_ngn": 500000000.0,
      "status": "active",
      "created_at": "2026-04-17T10:00:00Z",
      "updated_at": "2026-04-17T10:00:00Z"
    }
  ]
}
```

---

### `GET /api/customers/lookup-account/{account_number}`
**Description:** Get beneficiary account holder info.

**Request payload**
```json
{}
```

**Success response**
```json
{
  "account_number": "9009876543",
  "customer_name": "John Smith",
  "account_type": "current"
}
```

---

### `GET /api/customers/by-bvn/{bvn}`
**Description:** Get customer by BVN.

**Request payload**
```json
{}
```

**Success response**
```json
{
  "id": "cust_abc123",
  "bvn": "12345678901",
  "name": "Jane Doe",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "+2348000000000",
  "kyc_completed": true,
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:15:00Z"
}
```

---

### `GET /api/customers/{customer_id}`
**Description:** Get customer by ID.

**Request payload**
```json
{}
```

**Success response**
```json
{
  "id": "cust_abc123",
  "bvn": "12345678901",
  "name": "Jane Doe",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "+2348000000000",
  "kyc_completed": true,
  "created_at": "2026-04-17T10:00:00Z",
  "updated_at": "2026-04-17T10:15:00Z"
}
```

---

### `GET /api/customers/{customer_id}/accounts`
**Description:** List customer accounts.

**Request payload**
```json
{}
```

**Success response**
```json
[
  {
    "id": "acct_001",
    "customer_id": "cust_abc123",
    "account_number": "9001234567",
    "account_type": "current",
    "balance_ngn": 500000000.0,
    "status": "active",
    "created_at": "2026-04-17T10:00:00Z",
    "updated_at": "2026-04-17T10:00:00Z"
  }
]
```

---

### `GET /api/customers/{customer_id}/kyc-status`
**Description:** Get KYC and transfer limit state.

**Request payload**
```json
{}
```

**Success response**
```json
{
  "customer_id": "cust_abc123",
  "kyc_completed": true,
  "has_reference_image": true,
  "current_limit_ngn": 1000000.0
}
```

---

### `PATCH /api/customers/{customer_id}/limit`
**Description:** Update transfer limit (KYC required).

**Request payload**
```json
{
  "limit_ngn": 5000000
}
```

**Success response**
```json
{
  "customer_id": "cust_abc123",
  "current_limit_ngn": 5000000.0
}
```

---
KEY PAIR GENERATION /  SIGNING AND VALIDATION USING FIDO2 passkey and FIDO2 manual device keys
---

## Device Auth (`/api/device-auth`)

### `POST /api/device-auth/register`
**Description:** Register device public key.

**Request payload**
```json
{
  "customer_id": "cust_abc123",
  "public_key": "base64url-encoded-public-key",
  "algorithm": "ed25519"
}
```

**Success response**
```json
{
  "registered": true,
  "customer_id": "cust_abc123"
}
```

---

### `POST /api/device-auth/challenge`
**Description:** Create one-time login challenge.

**Request payload**
```json
{
  "customer_id": "cust_abc123"
}
```

**Success response**
```json
{
  "challenge": "V4j2nqFf...base64url..."
}
```

---

### `POST /api/device-auth/verify`
**Description:** Verify signed login challenge.

**Request payload**
```json
{
  "customer_id": "cust_abc123",
  "challenge": "V4j2nqFf...base64url...",
  "signature": "base64url-signature",
  "device_name": "iPhone 17 Pro Max"
}
```

**Success response**
```json
{
  "verified": true,
  "customer_id": "cust_abc123"
}
```

---

### `POST /api/device-auth/transaction-challenge`
**Description:** Create transaction signing challenge.

**Request payload**
```json
{
  "customer_id": "cust_abc123",
  "amount_ngn": 25000,
  "beneficiary_account_number": "9009876543"
}
```

**Success response**
```json
{
  "state_id": "w5v5j-u-I3Q0f9...token...",
  "challenge": "R0M9y...base64url...",
  "nonce": "f4ad9a4c73c84b5ba36f7f7509f12d13"
}
```

---

### `POST /api/device-auth/transaction-verify`
**Description:** Verify transaction challenge signature and authorize transfer state.

**Request payload**
```json
{
  "state_id": "w5v5j-u-I3Q0f9...token...",
  "signature": "base64url-signature",
  "device_name": "iPhone 17 Pro Max"
}
```

**Success response**
```json
{
  "authorized": true,
  "state_id": "w5v5j-u-I3Q0f9...token...",
  "message": "Call POST /api/transactions/transfer with state_id in body to execute transfer."
}
```

---

## FIDO2 / Passkeys (`/api/fido2`)

### `POST /api/fido2/register/begin`
**Description:** Begin passkey registration.

**Request payload**
```json
{
  "customer_id": "cust_abc123"
}
```

**Success response (example shape)**
```json
{
  "challenge": "v3By...base64url...",
  "rp": {
    "id": "localhost",
    "name": "AccessMore"
  },
  "user": {
    "id": "kJ3...base64url...",
    "name": "cust_abc123",
    "displayName": "Jane Doe"
  },
  "pub_key_cred_params": [
    {
      "type": "public-key",
      "alg": -7
    }
  ],
  "timeout": 60000
}
```

---

### `POST /api/fido2/register/complete/{customer_id}`
**Description:** Complete passkey registration.

**Request payload**
```json
{
  "credential": {
    "id": "credential-id",
    "rawId": "raw-id-base64url",
    "type": "public-key",
    "response": {
      "clientDataJSON": "base64url",
      "attestationObject": "base64url"
    }
  }
}
```

**Success response**
```json
{
  "status": "ok",
  "credential_id": "base64url-credential-id"
}
```

---

### `POST /api/fido2/authenticate/begin`
**Description:** Begin passkey authentication.

**Request payload**
```json
{
  "customer_id": "cust_abc123"
}
```

**Success response (example shape)**
```json
{
  "challenge": "d0pr...base64url...",
  "rpId": "localhost",
  "allow_credentials": [
    {
      "type": "public-key",
      "id": "credential-id-base64url",
      "transports": [
        "internal"
      ]
    }
  ],
  "timeout": 60000
}
```

---

### `POST /api/fido2/authenticate/complete/{customer_id}`
**Description:** Complete passkey authentication.

**Request payload**
```json
{
  "assertion": {
    "credentialId": "credential-id-base64url",
    "rawId": "raw-id-base64url",
    "clientDataJSON": "base64url",
    "authenticatorData": "base64url",
    "signature": "base64url",
    "userHandle": "base64url"
  }
}
```

**Success response**
```json
{
  "authenticated": true
}
```

---

### `POST /api/fido2/transaction/initiate`
**Description:** Create transaction challenge for passkey authorization.

**Request payload**
```json
{
  "customer_id": "cust_abc123",
  "amount_ngn": 25000,
  "beneficiary_account_number": "9009876543"
}
```

**Success response**
```json
{
  "state_id": "w5v5j-u-I3Q0f9...token...",
  "challenge": "R0M9y...base64url...",
  "nonce": "f4ad9a4c73c84b5ba36f7f7509f12d13"
}
```

---

### `POST /api/fido2/transaction/authorize`
**Description:** Verify passkey assertion and authorize pending transfer.

**Request payload**
```json
{
  "state_id": "w5v5j-u-I3Q0f9...token...",
  "sender_customer_id": "cust_abc123",
  "beneficiary_account_number": "9009876543",
  "amount_ngn": 25000,
  "assertion": {
    "credentialId": "credential-id-base64url",
    "rawId": "raw-id-base64url",
    "clientDataJSON": "base64url",
    "authenticatorData": "base64url",
    "signature": "base64url",
    "userHandle": "base64url"
  }
}
```

**Success response**
```json
{
  "authorized": true,
  "state_id": "w5v5j-u-I3Q0f9...token...",
  "message": "Call POST /api/transactions/transfer with state_id in body to execute transfer."
}
```
