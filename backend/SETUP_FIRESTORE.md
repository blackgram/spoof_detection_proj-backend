# Firestore setup guide

You do **not** create collections by hand. Firestore creates them when the app first writes data. You only need to: (1) enable Firestore, (2) set credentials, and (3) create one index for transfers.

---

## 1. Create a GCP project (if you don’t have one)

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown → **New Project**.
3. Name it (e.g. `accessmore-poc`) and click **Create**.

---

## 2. Enable Firestore (Native mode)

1. In the console, open **Firestore** (search or **Build** → **Firestore**).
2. Click **Create database**.
3. Choose **Native mode** (not Datastore mode).
4. Pick a location (e.g. `us-central1`) and click **Enable**.

Collections used by this app:

- `customers` – created automatically on first customer write.
- `customers/{id}/accounts` – subcollection, created on first account.
- `audit_logs` – created on first transfer.

You do **not** create these in the UI; the backend creates them when it runs.

---

## 3. Service account for local development

1. In the console: **IAM & Admin** → **Service Accounts**.
2. Click **Create Service Account**.
3. Name it (e.g. `firestore-backend`) → **Create and Continue**.
4. Under **Grant access**, add role: **Cloud Datastore User** (or **Firestore**-related roles if you see them).
5. Click **Done**.
6. Open the new service account → **Keys** → **Add Key** → **Create new key** → **JSON** → **Create**.  
   The JSON file is downloaded (e.g. `your-project-xxxxx.json`).

---

## 4. Backend environment variables

In the **backend** folder, create or edit `.env` (same directory as `run-local.sh`):

```bash
# Required: your GCP project ID (from step 1)
FIRESTORE_PROJECT_ID=your-gcp-project-id

# Required for local: path to the JSON key from step 3 (absolute or relative to backend/)
GOOGLE_APPLICATION_CREDENTIALS=./your-project-xxxxx.json
```

If you put the JSON key inside the backend folder:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./your-project-xxxxx.json
```

Then start the backend (e.g. `./run-local.sh`). On first run it will seed mock customers and create the collections.

---

## 5. Collection group index (required for transfers)

The app looks up beneficiary accounts by `account_number` across all customers. That needs a **collection group** index.

**Option A – From the error message**

1. Run the backend and trigger a transfer (e.g. from the mobile app).
2. If the index is missing, the backend log will show a Firestore error with a **link** to create the index.
3. Open the link in a browser, confirm project and index details, then click **Create**.

**Option B – From Firestore console**

1. Open [Firestore](https://console.cloud.google.com/firestore) → **Indexes**.
2. Click **Create index**.
3. Set:
   - **Collection group ID:** `accounts`
   - **Query scope:** Collection group
   - **Fields to index:**  
     - `account_number` → Ascending
4. Click **Create**.

After the index finishes building (a few minutes), transfers will work.

---

## 6. Quick checklist

| Step | What to do |
|------|------------|
| 1 | Create GCP project |
| 2 | Enable Firestore (Native mode) |
| 3 | Create service account, download JSON key, grant Firestore/Datastore role |
| 4 | In `backend/.env`: set `FIRESTORE_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` |
| 5 | Run backend; create collection group index on `accounts` (from error link or console) |

---

## Cloud Run (optional)

If you deploy the backend to **Cloud Run**:

- Set **only** `FIRESTORE_PROJECT_ID` in the Cloud Run service env (no key file).
- Use the same GCP project as Firestore.
- The default Cloud Run service account needs **Cloud Datastore User** (or equivalent Firestore) role:  
  **IAM & Admin** → find the service account used by Cloud Run → add that role.

---

## Verifying it works

1. Start backend: `./run-local.sh` (from `backend/`).
2. Log should show: `Seeded 3 mock customers...` (if the store was empty).
3. In [Firestore Console](https://console.cloud.google.com/firestore/data) you should see:
   - `customers` with 3 documents (Alice, Bob, Carol).
   - Under each, subcollection `accounts` with 1 document.
4. Run a transfer from the app; then check `audit_logs` for a new document.
