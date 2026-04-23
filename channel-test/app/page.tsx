"use client";

import { useState } from "react";
import {
  ensureCustomerByUsername,
  createAuthRequest,
  type AuthRequestType,
} from "@/lib/api";

type Result =
  | { type: "success"; requestId: string; requestType: string; pushSent: boolean }
  | { type: "error"; message: string };

export default function Home() {
  const [result, setResult] = useState<Result | null>(null);

  // Login form
  const [loginUsername, setLoginUsername] = useState("");
  const [loginLocation, setLoginLocation] = useState("Lagos, Nigeria");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Transfer form
  const [transferUsername, setTransferUsername] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferBeneficiary, setTransferBeneficiary] = useState("");
  const [transferAccount, setTransferAccount] = useState("");
  const [transferLocation, setTransferLocation] = useState("Internet Banking");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Consent form
  const [consentUsername, setConsentUsername] = useState("");
  const [consentService, setConsentService] = useState("Data sharing");
  const [consentDescription, setConsentDescription] = useState("Share account balance with partner app");
  const [consentSubmitting, setConsentSubmitting] = useState(false);

  async function submitRequest(
    type: AuthRequestType,
    getCustomerId: () => Promise<string>,
    getDetails: () => Record<string, unknown>,
    setSubmitting: (v: boolean) => void
  ) {
    setResult(null);
    setSubmitting(true);
    try {
      const customer_id = await getCustomerId();
      const res = await createAuthRequest({
        customer_id,
        request_type: type,
        channel: "channel_test_web",
        details: getDetails(),
        expires_in_seconds: 300,
      });
      const pushSent = "push_sent" in res ? (res as { push_sent?: boolean }).push_sent === true : false;
      setResult({
        type: "success",
        requestId: res.request_id,
        requestType: type,
        pushSent,
      });
    } catch (e) {
      setResult({
        type: "error",
        message: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <h1 className="text-xl font-semibold">Push Auth Channel Tester</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Trigger authorization requests; the user approves or rejects in the mobile app.
        </p>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-8">
        {result && (
          <div
            className={`rounded-lg border p-4 ${
              result.type === "success"
                ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
            }`}
          >
            {result.type === "success" ? (
              <div className="text-sm space-y-1">
                <p>
                  <strong>Request sent.</strong> Request ID: <code className="font-mono text-xs">{result.requestId}</code>
                </p>
                <p>Check the mobile app to approve or reject the {result.requestType} request.</p>
                {!result.pushSent && (
                  <p className="text-amber-700 dark:text-amber-400 mt-2">
                    No push was sent (device may not be registered). Ensure the user has logged in on a physical device, granted notification permission, and is not using a simulator.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-700 dark:text-red-300">{result.message}</p>
            )}
          </div>
        )}

        {/* Login request */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">Login authorization</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Simulate a login from another channel; user approves on the device.
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitRequest(
                "login",
                async () => {
                  const { customer_id } = await ensureCustomerByUsername(loginUsername);
                  return customer_id;
                },
                () => ({
                  city: loginLocation,
                  ip: "192.168.1.1",
                  device: "Chrome on Windows",
                }),
                setLoginSubmitting
              );
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="e.g. alice"
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input
                type="text"
                value={loginLocation}
                onChange={(e) => setLoginLocation(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loginSubmitting}
              className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {loginSubmitting ? "Sending…" : "Send login request"}
            </button>
          </form>
        </section>

        {/* Transfer request */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">Transfer authorization</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Simulate a transfer; user sees amount and beneficiary and approves on the device.
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitRequest(
                "transfer",
                async () => {
                  const { customer_id } = await ensureCustomerByUsername(transferUsername);
                  return customer_id;
                },
                () => ({
                  amount_ngn: Number(transferAmount) || 0,
                  beneficiary_name: transferBeneficiary,
                  beneficiary_account_number: transferAccount,
                  location: transferLocation,
                }),
                setTransferSubmitting
              );
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1">Username (customer)</label>
              <input
                type="text"
                value={transferUsername}
                onChange={(e) => setTransferUsername(e.target.value)}
                placeholder="e.g. alice"
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Amount (NGN)</label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="50000"
                  required
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Origin location</label>
                <input
                  type="text"
                  value={transferLocation}
                  onChange={(e) => setTransferLocation(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Beneficiary name</label>
              <input
                type="text"
                value={transferBeneficiary}
                onChange={(e) => setTransferBeneficiary(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Beneficiary account number</label>
              <input
                type="text"
                value={transferAccount}
                onChange={(e) => setTransferAccount(e.target.value)}
                placeholder="1234567890"
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={transferSubmitting}
              className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {transferSubmitting ? "Sending…" : "Send transfer request"}
            </button>
          </form>
        </section>

        {/* Consent request */}
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">Consent authorization</h2>
          <p className="text-sm text-zinc-500 mb-4">
            Simulate a consent request (e.g. grant access to data); user approves on the device.
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submitRequest(
                "consent",
                async () => {
                  const { customer_id } = await ensureCustomerByUsername(consentUsername);
                  return customer_id;
                },
                () => ({
                  service_name: consentService,
                  description: consentDescription,
                  permissions: ["Read balance", "View transactions"],
                }),
                setConsentSubmitting
              );
            }}
          >
            <div>
              <label className="block text-sm font-medium mb-1">Username (customer)</label>
              <input
                type="text"
                value={consentUsername}
                onChange={(e) => setConsentUsername(e.target.value)}
                placeholder="e.g. alice"
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Service name</label>
              <input
                type="text"
                value={consentService}
                onChange={(e) => setConsentService(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                value={consentDescription}
                onChange={(e) => setConsentDescription(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={consentSubmitting}
              className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {consentSubmitting ? "Sending…" : "Send consent request"}
            </button>
          </form>
        </section>

        <p className="text-xs text-zinc-500 text-center pb-8">
          Backend: {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}. Ensure the user has logged in on the
          mobile app at least once so the device is registered for push.
        </p>
      </main>
    </div>
  );
}
