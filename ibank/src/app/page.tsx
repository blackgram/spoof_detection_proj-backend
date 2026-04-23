"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccessLogo from "@/components/AccessLogo";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready, setUserFromSession } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [requiresTokenVerification, setRequiresTokenVerification] = useState(false);
  const [pendingUser, setPendingUser] = useState<api.LoginResponse | null>(null);

  useEffect(() => {
    if (ready && user) {
      router.replace("/home");
    }
  }, [ready, user, router]);

  useEffect(() => {
    return () => {
      // no-op cleanup placeholder for future abortable polling
    };
  }, []);

  const usernameClean = username.trim();

  async function submitCredentialsForToken() {
    if (!usernameClean || !password) {
      setError("Please enter your username and password");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const loginData = await api.login(usernameClean, password);
      setPendingUser(loginData);
      setRequiresTokenVerification(true);
      setInfo("Enter your token from your authenticator app to complete sign in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyTokenAndSignIn() {
    if (!pendingUser) {
      setError("Please sign in with username and password first.");
      return;
    }
    if (!token.trim()) {
      setError("Please enter your token code");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const verify = await api.verifyTotpForTransfer({
        customer_id: pendingUser.customer_id,
        username: pendingUser.username,
        totp_code: token.trim(),
      });
      if (!verify.valid) {
        throw new Error(verify.message || "Invalid token code");
      }
      setUserFromSession({
        customer_id: pendingUser.customer_id,
        username: pendingUser.username,
        name: pendingUser.name,
        accounts: pendingUser.accounts,
      });
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function startPasswordlessPushLogin() {
    if (!usernameClean) {
      setError("Enter your username to continue with push login.");
      return;
    }
    setError(null);
    setInfo(null);
    setPushLoading(true);
    try {
      const loginData = await api.login(usernameClean, "");
      const req = await api.createPushAuthRequest({
        customer_id: loginData.customer_id,
        request_type: "login",
        channel: "ibank_web",
        details: { username: loginData.username },
      });
      if (!req.push_sent) {
        setInfo("Push request created, but no registered device token was found.");
      } else {
        setInfo("Push sent. Approve the login from your registered phone.");
      }

      const startedAt = Date.now();
      const timeoutMs = 120_000;
      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const status = await api.getPushAuthRequest(req.request_id);
        if (status.status === "approved") {
          setUserFromSession({
            customer_id: loginData.customer_id,
            username: loginData.username,
            name: loginData.name,
            accounts: loginData.accounts,
          });
          router.push("/home");
          return;
        }
        if (status.status === "rejected") {
          throw new Error("Push login was rejected on the registered phone.");
        }
        if (status.status === "expired") {
          throw new Error("Push login request expired. Please try again.");
        }
      }
      throw new Error("Push login timed out. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push login failed");
    } finally {
      setPushLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top announcement bar */}
      <div className="bg-black text-white text-sm text-center py-2 px-4">
        Link your BVN or NIN to your account{" "}
        <span role="img" aria-label="link">
          🔗
        </span>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <AccessLogo className="h-8 w-auto" />

        {/* Country selector */}
        <button className="flex items-center gap-2 border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          {/* Nigerian flag */}
          <span className="flex gap-0.5">
            <span className="w-3 h-4 bg-green-700 rounded-sm" />
            <span className="w-3 h-4 bg-white border border-gray-200" />
            <span className="w-3 h-4 bg-green-700 rounded-sm" />
          </span>
          <svg
            className="w-3 h-3 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </header>

      {/* Main content */}
      <main className="flex flex-1">
        {/* Left: form */}
        <div className="flex flex-col justify-center px-16 py-12 max-w-xl w-full">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-3">
            Welcome to Access Internet Banking
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-1">
            Sign in with your Internet Banking details or Access More login
            details. Not registered on Internet Banking or Access More? Click on
            register to get started
          </p>
          <p className="text-sm text-gray-500 mb-8">
            No account?{" "}
            <a href="#" className="text-orange-500 underline font-medium">
              Open savings account
            </a>
          </p>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (requiresTokenVerification) {
                await verifyTokenAndSignIn();
                return;
              }
              await submitCredentialsForToken();
            }}
            className="space-y-4"
          >
            {/* Username */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-200 rounded pl-12 pr-4 py-3.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded pl-12 pr-12 py-3.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            </div>

            {requiresTokenVerification && (
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Token code"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\s+/g, ""))}
                  className="w-full border border-gray-200 rounded pl-12 pr-4 py-3.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-300"
                />
              </div>
            )}

            {info && <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded px-3 py-2">{info}</p>}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>
            )}

            <div className="flex justify-end">
              <a href="#" className="text-sm text-orange-500 font-medium hover:underline">
                Forgot Username or Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading || pushLoading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold text-center py-3.5 rounded transition-colors"
            >
              {loading ? (requiresTokenVerification ? "Verifying token…" : "Signing in…") : requiresTokenVerification ? "Verify token & sign in" : "Sign in"}
            </button>

            <button
              type="button"
              onClick={startPasswordlessPushLogin}
              disabled={loading || pushLoading}
              className="w-full border border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-60 font-medium py-3.5 rounded transition-colors text-sm"
            >
              {pushLoading ? "Waiting for phone approval…" : "Login with Passwordless"}
            </button>

            <Link
              href="/register"
              className="block w-full border border-gray-300 text-gray-700 font-medium py-3.5 rounded hover:bg-gray-50 transition-colors text-sm text-center"
            >
              Register on internet banking
            </Link>
          </form>
        </div>

        {/* Right: phone mockup */}
        <div className="flex-1 flex items-center justify-center bg-gray-50 relative overflow-hidden">
          {/* Decorative wave/curves */}
          <div className="absolute bottom-0 left-0 right-0 h-2/3">
            <svg viewBox="0 0 600 400" className="w-full h-full" preserveAspectRatio="none">
              <path
                d="M0,200 Q150,100 300,180 Q450,260 600,160 L600,400 L0,400 Z"
                fill="#e5e7eb"
                opacity="0.4"
              />
              <path
                d="M0,260 Q150,200 300,240 Q450,280 600,220 L600,400 L0,400 Z"
                fill="#d1d5db"
                opacity="0.3"
              />
            </svg>
          </div>

          {/* Phone frame */}
          <div className="relative z-10">
            <div
              className="relative bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden"
              style={{ width: 220, height: 440 }}
            >
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-gray-900 rounded-b-2xl z-10" />
              {/* Screen */}
              <div className="absolute inset-2 rounded-[2rem] bg-blue-900 overflow-hidden">
                {/* Status bar */}
                <div className="flex items-center justify-between px-4 pt-6 pb-2 text-white text-xs">
                  <span>10:37</span>
                  <div className="flex gap-1 items-center">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                  </div>
                </div>

                {/* Access logo on screen */}
                <div className="px-3 pb-1">
                  <div className="text-orange-400 font-bold text-sm flex items-center gap-1">
                    <span className="text-orange-400">▲</span> access
                  </div>
                </div>

                {/* Greeting */}
                <div className="px-3 py-1">
                  <p className="text-white text-xs opacity-70">Good afternoon,</p>
                  <p className="text-white font-bold text-sm">Duaghene</p>
                </div>

                {/* Blue card rows */}
                {[
                  "Make Transfer",
                  "Airtime & Data",
                  "Bill Payments",
                  "Foreign Transfer",
                ].map((item) => (
                  <div
                    key={item}
                    className="mx-3 my-1 rounded-lg p-2 flex items-center gap-2"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  >
                    <div className="w-5 h-5 rounded-full bg-orange-400 opacity-80" />
                    <span className="text-white text-xs">{item}</span>
                  </div>
                ))}

                {/* "Show All" */}
                <div className="text-center mt-2">
                  <span className="text-blue-300 text-xs">Show All ▼</span>
                </div>

                {/* 1-Tap label */}
                <div className="px-3 mt-2">
                  <p className="text-white text-xs font-semibold">1-Tap Payment</p>
                  <p className="text-blue-300 text-xs mt-1 opacity-70">
                    You have no active 1-tap payment
                  </p>
                </div>
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-600 rounded-full" />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-8 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>
            Our{" "}
            <a href="#" className="text-orange-500 underline">
              Privacy Policy
            </a>
          </span>
          <span className="text-gray-300">|</span>
          <span>
            Having an problem?{" "}
            <a href="#" className="text-orange-500 underline">
              Chat with us
            </a>
          </span>
        </div>
        <span>©2026 Access Bank PLC | licensed by the Central Bank of Nigeria</span>
      </footer>
    </div>
  );
}
