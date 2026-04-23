# Push Auth Channel Tester

A Next.js web app used to **test push authorization** from an external channel. It simulates the “other channel” (e.g. internet banking, Microsoft Authenticator) that creates authorization requests and sends a push to the user’s mobile app.

## Prerequisites

- **Backend** (FastAPI) running, e.g. `cd backend && uvicorn app.main:app --reload --host 0.0.0.0`
- **Mobile app** with the user logged in at least once so the device is registered for push

## Setup

1. Install dependencies: `npm install`
2. Copy env: `cp .env.local.example .env.local`
3. Set `NEXT_PUBLIC_API_URL` in `.env.local` if your backend is not at `http://localhost:8000` (e.g. use your machine IP when testing from another device)

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

- **Login authorization**: Enter the **username** of the customer (same as in the mobile app). Optionally set location. Submit to send a “login” push request; the user approves or rejects in the app.
- **Transfer authorization**: Enter username, amount (NGN), beneficiary name and account, and origin location. Submit to send a “transfer” push request.
- **Consent authorization**: Enter username, service name, and description. Submit to send a “consent” push request.

The app uses `POST /api/customers/ensure-by-username` to resolve username to `customer_id`, then `POST /api/push-auth/request` to create the request and trigger the push. Ensure the customer has logged in on the mobile app at least once so a push token is registered.
