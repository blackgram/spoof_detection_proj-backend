"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccessLogo from "@/components/AccessLogo";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { user, ready, login } = useAuth();
  const [accountNumber, setAccountNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace("/home");
    }
  }, [ready, user, router]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="bg-black text-white text-sm text-center py-2 px-4">
        Link your BVN or NIN to your account{" "}
        <span role="img" aria-label="link">
          🔗
        </span>
      </div>

      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <Link href="/">
          <AccessLogo className="h-8 w-auto" />
        </Link>
      </header>

      <main className="flex flex-1 justify-center px-8 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Register for Internet Banking</h1>
          <p className="text-sm text-gray-500 mb-6">
            Use the same username and password as the mobile app, or create a new profile linked to your account number.
          </p>

          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (password !== confirm) {
                setError("Passwords do not match");
                return;
              }
              setLoading(true);
              try {
                await api.registerCustomer({
                  account_number: accountNumber,
                  phone,
                  username,
                  password,
                });
                await login(username.trim(), password);
                router.push("/home");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Registration failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account number</label>
              <input
                type="text"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full border border-gray-200 rounded px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                placeholder="10-digit account number"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-200 rounded px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                placeholder="Phone number"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-200 rounded px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                placeholder="Choose a username"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                placeholder="Password"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-200 rounded px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                placeholder="Confirm password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3.5 rounded transition-colors"
            >
              {loading ? "Creating account…" : "Register"}
            </button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/" className="text-orange-500 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
