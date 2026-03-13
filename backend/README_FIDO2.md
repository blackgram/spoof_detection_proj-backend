# FIDO2 / Passkey authentication and transaction authorization

KYC flow is still used for **limits and device registration**. FIDO2/Passkey is used for **authentication** (login) and **transaction authorization** (signing transfers).

## Architecture (summary)

- Device generates a key pair; private key stays in Secure Enclave / TEE; public key is sent to the backend.
- Biometrics unlock the private key locally; the key signs a server challenge.
- Backend verifies the signature with the stored public key.

## Backend endpoints

| Endpoint | Purpose |
|----------|--------|
| `POST /api/fido2/register/begin` | Start passkey registration (body: `{ "customer_id": "..." }`). |
| `POST /api/fido2/register/complete/{customer_id}` | Complete registration with attestation from client. |
| `POST /api/fido2/authenticate/begin` | Start login (body: `{ "customer_id": "..." }`). |
| `POST /api/fido2/authenticate/complete/{customer_id}` | Complete login with assertion from client. |
| `POST /api/fido2/transaction/initiate` | Get transaction signing challenge (amount, beneficiary). |
| `POST /api/fido2/transaction/authorize` | Verify signed assertion; then client calls transfer with `state_id`. |

## Transfer flow (FIDO2)

1. Client calls `POST /api/fido2/transaction/initiate` with `customer_id`, `amount_ngn`, `beneficiary_account_number`.
2. Server returns `state_id` and `challenge` (base64url).
3. Client signs `challenge` with passkey (getAssertion) and sends assertion to `POST /api/fido2/transaction/authorize` with `state_id`, assertion, and same transaction params.
4. Server verifies assertion and marks the state as authorized.
5. Client calls `POST /api/transactions/transfer` with the same params and **`state_id`** in the body. Server consumes the authorized state and executes the transfer.

## Config

- `FIDO2_RP_ID`: Relying party ID (e.g. `localhost` for dev, or your domain).
- `FIDO2_RP_NAME`: Display name (e.g. `AccessMore`).

## Dependencies

- `fido2` (PyPI). Install: `pip install fido2`.

Credentials are stored in Firestore collection `fido2_credentials` (or in-memory when Firestore is not configured). Registration and authentication session state is in-memory; for production you may want Redis or signed cookies.
