# Firestore setup (KYC & customers)

The backend can store customers, KYC status, and reference images in **Firestore** or fall back to an **in-memory store** when Firestore is not configured.

## Environment variables

| Variable | Description |
|----------|-------------|
| `FIRESTORE_PROJECT_ID` | Your Google Cloud project ID. If unset, the app uses an in-memory store (no persistence). |
| `GOOGLE_APPLICATION_CREDENTIALS` | (Optional) Path to a service account JSON key file. Used for local dev; on **Cloud Run**, Application Default Credentials (ADC) are used automatically. |

## Cloud Run

1. Set `FIRESTORE_PROJECT_ID` in your Cloud Run service (e.g. in the console or via `gcloud run services update`).
2. Ensure the Cloud Run service identity has the **Cloud Datastore User** (or **Firestore** roles) so it can read/write Firestore.

## Local development

1. Create a GCP project and enable Firestore (Native mode).
2. Create a service account with Firestore permissions and download its JSON key.
3. Set in your shell or `.env`:
   - `FIRESTORE_PROJECT_ID=your-project-id`
   - `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`

## Data model

- **Collection `customers`**  
  Document ID = auto-generated customer ID.  
  Fields: `bvn`, `name`, `email`, `phone`, `kyc_completed`, `reference_image_base64`, `created_at`, `updated_at`.

- **Subcollection `accounts`** (under each customer)  
  Fields: `account_number`, `account_type`, `balance_ngn`, `status`, `created_at`, `updated_at`.

- **Collection `audit_logs`** (transaction audit, AccessMore-style)  
  One document per transfer. Fields: `transaction_id`, `user_id`, `device_id`, `public_key_id`, `nonce`, `transaction_hash`, `digital_signature`, `biometric_modality`, `timestamp`, `risk_score`, `ip_address`, `sender_customer_id`, `beneficiary_customer_id`, `amount_ngn`.

## Collection group index (for transfers)

To look up a beneficiary by account number, the app queries the `accounts` subcollection across all customers. In the Firestore console, create a **collection group** index:

- Collection group ID: `accounts`
- Field: `account_number` (Ascending)

Or run the index creation from the error message Firestore returns on first transfer.

## Mock data

On startup, if the store is empty, the backend seeds **3 mock KYC-verified customers** with accounts and balances for testing transfers:

| Name       | BVN          | Account No.  | Balance   |
|-----------|--------------|--------------|-----------|
| Alice Demo | 11111111111 | 1111222233  | ₦1,000,000 |
| Bob Demo   | 22222222222 | 2222333344  | ₦500,000   |
| Carol Demo | 33333333333 | 3333444455  | ₦750,000   |

You can transfer between these accounts once your app user is KYC-verified (they get their own account with balance 0 until they receive a transfer or you top up).

### How to log in as a seeded account (mobile app)

The app has no backend login; it only stores a display name and password locally. To **act as** one of the seeded customers (Alice, Bob, Carol):

1. **Sign in** on the Login screen with any name and password (e.g. `Alice` / `test123`).
2. **Link to a seeded customer** by doing KYC onboarding with that customer’s BVN and name:
   - **Transfer flow:** Go to **Transfer** → enter amount **≥ ₦500,000** → tap Proceed → you’ll be sent to KYC. Enter BVN and name below, then complete the face capture.
   - **Limit flow:** Go to **Settings** → **Adjust limits** → **Start KYC** (or complete KYC first), then enter BVN and name below and complete the face capture.
3. On the **BVN screen**, enter exactly:
   - **Alice:** BVN `11111111111`, Name `Alice Demo`
   - **Bob:** BVN `22222222222`, Name `Bob Demo`
   - **Carol:** BVN `33333333333`, Name `Carol Demo`
4. Complete the **face capture**. The backend finds the existing customer by BVN and links your app session to that customer. You’ll then see that customer’s balance and can transfer to the other seeded accounts (use their **Account No.** in the table above).

Seeded accounts have no reference image until you do onboarding once; after that, future KYC checks (e.g. high-value transfer or limit increase) will use your captured face for verification.

Reference images are stored as base64 in the customer document to avoid extra storage cost; for production you may prefer Cloud Storage and store only a URL.
