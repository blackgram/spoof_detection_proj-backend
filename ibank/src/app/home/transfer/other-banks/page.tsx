"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccessLogo from "@/components/AccessLogo";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

const NAV_ITEMS = [
  {
    label: "Home",
    href: "/home",
    activeOn: "/home",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    label: "Beneficiaries",
    href: "#",
    activeOn: "/beneficiaries",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    href: "#",
    activeOn: "/transactions",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: "Support",
    href: "#",
    activeOn: "/support",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: "Profile Settings",
    href: "#",
    activeOn: "/profile",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function formatNgn(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function OtherBanksTransferPage() {
  const router = useRouter();
  const { user, ready, logout, refreshAccounts } = useAuth();
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [bank, setBank] = useState("KMF - Kuda Microfinance Bank");
  const [accountNumber, setAccountNumber] = useState("");
  const [beneficiaryName, setBeneficiaryName] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [showFeedback, setShowFeedback] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(1_000_000);

  const [pinOpen, setPinOpen] = useState(false);
  const [pinDigits, setPinDigits] = useState(["", "", "", ""]);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [pushWaiting, setPushWaiting] = useState(false);
  const [pushHint, setPushHint] = useState("");
  const [pushCompleting, setPushCompleting] = useState(false);
  const [pinBusyMessage, setPinBusyMessage] = useState<string | null>(null);
  const [highValueAuthOpen, setHighValueAuthOpen] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);
  const [authActionBusy, setAuthActionBusy] = useState<"token" | "push" | null>(null);
  const cancelledRef = useRef(false);

  const [success, setSuccess] = useState<{ transaction_id: string; amount_ngn: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);

  useEffect(() => {
    if (!user?.customer_id) return;
    let cancelled = false;
    (async () => {
      try {
        const k = await api.getKycStatus(user.customer_id);
        if (!cancelled) setDailyLimit(k.current_limit_ngn);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.customer_id]);

  useEffect(() => {
    const acct = accountNumber.replace(/\D/g, "").slice(0, 10);
    if (acct !== accountNumber) setAccountNumber(acct);
  }, [accountNumber]);

  useEffect(() => {
    if (accountNumber.length !== 10) {
      setBeneficiaryName(null);
      setLookupError(null);
      setLookupLoading(false);
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    const controller = new AbortController();
    const t = setTimeout(() => {
      api
        .lookupAccount(accountNumber, controller.signal)
        .then((l) => {
          setBeneficiaryName(l.customer_name);
        })
        .catch((e: unknown) => {
          if (
            (e instanceof Error || (typeof DOMException !== "undefined" && e instanceof DOMException)) &&
            (e as Error).name === "AbortError"
          ) {
            return;
          }
          const msg = e instanceof Error ? e.message : "Lookup failed";
          setBeneficiaryName(null);
          setLookupError(msg);
        })
        .finally(() => setLookupLoading(false));
    }, 120);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [accountNumber]);

  const primary = user?.accounts[0];

  const runTransfer = useCallback(
    async (amountNgn: number, beneficiary: string) => {
      if (!user) throw new Error("Not signed in");
      const audit = api.buildWebAuditPayload(user.customer_id, amountNgn, beneficiary);
      const res = await api.transfer({
        sender_customer_id: user.customer_id,
        beneficiary_account_number: beneficiary,
        amount_ngn: amountNgn,
        audit,
      });
      await refreshAccounts();
      return res;
    },
    [user, refreshAccounts]
  );

  const handleProceedClick = () => {
    setFormError(null);
    if (!primary) {
      setFormError("No source account.");
      return;
    }
    if (accountNumber.length !== 10 || !beneficiaryName) {
      setFormError("Enter a valid 10-digit beneficiary account.");
      return;
    }
    if (accountNumber === primary.account_number) {
      setFormError("Cannot transfer to your own account.");
      return;
    }
    const amountNgn = parseFloat(amount);
    if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
      setFormError("Enter a valid amount.");
      return;
    }
    if (amountNgn > primary.balance_ngn) {
      setFormError("Insufficient balance.");
      return;
    }
    if (amountNgn > dailyLimit) {
      setFormError(`Amount exceeds your transfer limit (₦${formatNgn(dailyLimit)}).`);
      return;
    }
    setPinDigits(["", "", "", ""]);
    setPinError(null);
    setPinOpen(true);
  };

  const pinString = pinDigits.join("");

  const focusPinIndex = (i: number) => {
    pinRefs.current[i]?.focus();
    pinRefs.current[i]?.select();
  };

  const handlePinDigitChange = (index: number, raw: string) => {
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly.length > 1) {
      const next = ["", "", "", ""] as [string, string, string, string];
      for (let j = 0; j < 4 && j < digitsOnly.length; j++) {
        next[j] = digitsOnly[j] ?? "";
      }
      setPinDigits(next);
      const last = Math.min(digitsOnly.length - 1, 3);
      focusPinIndex(last);
      return;
    }
    const d = digitsOnly.slice(0, 1);
    setPinDigits((prev) => {
      const next = [...prev] as [string, string, string, string];
      next[index] = d;
      return next;
    });
    if (d && index < 3) {
      setTimeout(() => focusPinIndex(index + 1), 0);
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      e.preventDefault();
      focusPinIndex(index - 1);
    }
  };

  useEffect(() => {
    if (pinOpen) {
      setTimeout(() => {
        pinRefs.current[0]?.focus();
      }, 0);
    }
  }, [pinOpen]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (pinString.length !== 4) {
      setPinError("Enter your 4-digit PIN.");
      return;
    }
    setPinError(null);
    setFormError(null);
    setSubmitting(true);

    const amountNgn = parseFloat(amount);
    const beneficiary = accountNumber;

    try {
      if (amountNgn >= api.HIGH_VALUE_TRANSFER_NGN) {
        setPinOpen(false);
        setHighValueAuthOpen(true);
        setTotpCode("");
        setTotpError(null);
      } else {
        setPinBusyMessage("Processing transfer…");
        const res = await runTransfer(amountNgn, beneficiary);
        setSuccess({ transaction_id: res.transaction_id, amount_ngn: amountNgn });
        setPinOpen(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transfer failed";
      setPinError(msg);
      setFormError(msg);
      setPushWaiting(false);
      setPushCompleting(false);
    } finally {
      setSubmitting(false);
      setPinBusyMessage(null);
      setPinDigits(["", "", "", ""]);
    }
  };

  const handleHighValueSendAuthorization = async () => {
    if (!user) return;
    const amountNgn = parseFloat(amount);
    const beneficiary = accountNumber;
    if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
      setTotpError("Invalid transfer amount.");
      return;
    }

    try {
      setAuthActionBusy("push");
      setTotpError(null);
      setPinBusyMessage("Sending authorization request…");
      cancelledRef.current = false;
      const req = await api.createPushAuthRequest({
        customer_id: user.customer_id,
        request_type: "transfer",
        channel: "ibank_web",
        details: {
          amount_ngn: amountNgn,
          beneficiary_account_number: beneficiary,
          beneficiary_name: beneficiaryName,
          bank,
          narration,
        },
        expires_in_seconds: 300,
      });
      setHighValueAuthOpen(false);
      setPushCompleting(false);
      setPushWaiting(true);
      setPushHint(
        req.push_sent
          ? "Open the mobile app and approve this transfer."
          : "Push may not reach your device (register for push on mobile). Waiting for approval…"
      );

      for (let i = 0; i < 150 && !cancelledRef.current; i++) {
        if (i > 0) await sleep(2000);
        const st = await api.getPushAuthRequest(req.request_id);
        if (st.status === "approved") {
          setPushCompleting(true);
          setPushHint("Completing transfer…");
          const res = await runTransfer(amountNgn, beneficiary);
          setSuccess({ transaction_id: res.transaction_id, amount_ngn: amountNgn });
          setPushWaiting(false);
          setPushCompleting(false);
          return;
        }
        if (st.status === "rejected" || st.status === "expired") {
          setFormError(
            st.status === "expired"
              ? "Authorization request expired. Try again."
              : "Transfer was rejected on your mobile app."
          );
          setPushWaiting(false);
          setPushCompleting(false);
          return;
        }
      }
      if (!cancelledRef.current) {
        setFormError("Authorization timed out. Try again.");
      }
      setPushWaiting(false);
      setPushCompleting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send authorization request";
      setTotpError(msg);
      setFormError(msg);
      setPushWaiting(false);
      setPushCompleting(false);
    } finally {
      setAuthActionBusy(null);
      setPinBusyMessage(null);
    }
  };

  const handleHighValueVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanCode = totpCode.replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) {
      setTotpError("Enter your 6-digit token.");
      return;
    }
    const amountNgn = parseFloat(amount);
    const beneficiary = accountNumber;
    if (!Number.isFinite(amountNgn) || amountNgn <= 0) {
      setTotpError("Invalid transfer amount.");
      return;
    }

    try {
      setAuthActionBusy("token");
      setTotpError(null);
      const verify = await api.verifyTotpForTransfer({
        customer_id: user.customer_id,
        username: user.username,
        totp_code: cleanCode,
      });
      if (!verify.valid) {
        setTotpError(verify.message || "Invalid token.");
        return;
      }

      setPinBusyMessage("Processing transfer…");
      const res = await runTransfer(amountNgn, beneficiary);
      setSuccess({ transaction_id: res.transaction_id, amount_ngn: amountNgn });
      setHighValueAuthOpen(false);
      setTotpCode("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Token verification failed";
      setTotpError(msg);
      setFormError(msg);
    } finally {
      setAuthActionBusy(null);
      setPinBusyMessage(null);
    }
  };

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
        Loading…
      </div>
    );
  }
  if (!user || !primary) {
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen flex bg-gray-50 items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">Transfer successful</h1>
          <p className="text-sm text-gray-600 mb-1">
            ₦{formatNgn(success.amount_ngn)} sent successfully.
          </p>
          <p className="text-xs text-gray-400 mb-6 break-all">Ref: {success.transaction_id}</p>
          <Link
            href="/home"
            className="inline-block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl text-sm"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col min-h-screen shadow-sm shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <AccessLogo className="h-7 w-auto" />
        </div>

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => {
            const active = item.activeOn === "/home";
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "text-orange-500 bg-orange-50 border-r-2 border-orange-500"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className={active ? "text-orange-500" : "text-gray-400"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100">
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>

        {showFeedback && (
          <div className="m-3 mb-4 bg-gray-50 border border-gray-200 rounded-xl p-3 relative">
            <button
              onClick={() => setShowFeedback(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex justify-center mb-2">
              <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="#FEF3E2" />
                <path d="M24 12c-6.6 0-12 5.4-12 12s5.4 12 12 12 12-5.4 12-12-5.4-12-12-12zm0 4c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm0 17c-3 0-5.7-1.5-7.4-3.8.6-2.4 4.8-3.7 7.4-3.7 2.6 0 6.8 1.3 7.4 3.7C29.7 31.5 27 33 24 33z" fill="#E8761A" />
              </svg>
            </div>
            <p className="text-xs text-gray-600 text-center font-medium leading-snug">Like our new platform?</p>
            <button className="mt-2 w-full bg-gray-900 text-white text-xs py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors">
              Click here to tell us
            </button>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-h-screen overflow-auto">
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-semibold text-gray-800">
            Hello, {user.name.split(/\s+/)[0]}{" "}
            <span role="img" aria-label="wave">
              👋
            </span>
          </h1>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
            </button>
            <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
              {user.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "?"}
            </div>
            <span className="text-sm font-medium text-gray-700">{user.name}</span>
          </div>
        </header>

        <div className="flex-1 px-8 py-6">
          <div className="mb-4">
            <Link
              href="/home"
              className="inline-flex items-center gap-1 text-sm text-orange-500 font-medium hover:underline"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          </div>

          <h1 className="text-base font-bold text-gray-800 mb-2">Other Bank Transfers</h1>
          <p className="text-xs text-gray-500 mb-4">
            Transfers of ₦{formatNgn(api.HIGH_VALUE_TRANSFER_NGN)} or more require an extra step after PIN:
            verify with token or send mobile authorization.
          </p>

          {formError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}

          <div className="flex gap-6">
            <div className="flex-1 max-w-2xl space-y-5">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-end gap-3 px-4 pt-3 pb-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">
                    {balanceVisible ? `₦${formatNgn(primary.balance_ngn)}` : "₦••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBalanceVisible((v) => !v)}
                    className="flex items-center gap-1.5 text-orange-500 text-xs font-medium hover:underline"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                    {balanceVisible ? "Hide balance" : "Show balance"}
                  </button>
                </div>

                <div className="px-4 py-3">
                  <label className="block text-xs text-gray-400 mb-1.5">Source account</label>
                  <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2.5 bg-white">
                    <span className="flex-1 text-sm text-gray-700 uppercase">
                      {primary.account_type} — {primary.account_number} (Regular)
                    </span>
                  </div>
                </div>

                <div className="px-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      Daily Transaction Limit: ₦{formatNgn(dailyLimit)}
                    </span>
                  </div>
                  <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                    <div className="absolute left-0 top-0 h-full w-1 bg-orange-400 rounded-full" />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-orange-500 font-medium">₦0.00 used</span>
                    <span className="text-gray-500">₦{formatNgn(dailyLimit)}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">Frequent Beneficiaries</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="bg-white border border-gray-100 rounded-xl py-5 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-orange-500">View all</span>
                  </button>
                  <div className="bg-white border border-gray-100 rounded-xl py-5 flex flex-col items-center justify-center gap-2 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                      {beneficiaryName ? beneficiaryName.slice(0, 2).toUpperCase() : "—"}
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center px-2 truncate max-w-full">
                      {beneficiaryName ?? "Beneficiary"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-4 py-3">
                  <label className="block text-xs text-gray-400 mb-1.5">Bank</label>
                  <div className="flex items-center">
                    <span className="flex-1 text-sm text-gray-700">{bank}</span>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 mx-2"
                      onClick={() => setBank("")}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-4 py-3">
                  <label className="block text-xs text-gray-400 mb-1.5">Beneficiary account number</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full text-sm text-gray-800 bg-transparent outline-none placeholder-gray-300"
                    placeholder="Enter account number"
                  />
                  {lookupLoading && <p className="text-xs text-gray-400 mt-1">Looking up…</p>}
                  {lookupError && accountNumber.length === 10 && (
                    <p className="text-xs text-red-500 mt-1">{lookupError}</p>
                  )}
                  {beneficiaryName && accountNumber.length === 10 && !lookupLoading && (
                    <p className="text-right text-xs text-gray-500 mt-1.5">{beneficiaryName}</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-4 py-3">
                  <label className="block text-xs text-gray-400 mb-1.5">Amount</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-400 font-medium">₦</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder-gray-300"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs mt-2">
                    <span className="text-gray-400">Maximum Amount: </span>
                    <span className="text-orange-500 font-medium">₦{formatNgn(dailyLimit)}</span>
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="px-4 py-3">
                  <label className="block text-xs text-gray-400 mb-1.5">Narration</label>
                  <input
                    type="text"
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    className="w-full text-sm text-gray-800 bg-transparent outline-none placeholder-gray-300"
                    placeholder=""
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleProceedClick}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-4 rounded-xl transition-colors text-sm shadow-sm"
              >
                {submitting ? "Processing…" : "Proceed"}
              </button>
            </div>

            <div className="w-72 shrink-0">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex gap-3">
                <div className="shrink-0 mt-0.5">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-400">i</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Dear Customer, a token is required to complete this transaction. Don&apos;t have a token? Please call
                  our Contact Center on{" "}
                  <a href="tel:02012802500" className="text-orange-500 font-medium hover:underline">
                    0201 280 2500
                  </a>
                  , send an email to{" "}
                  <a
                    href="mailto:contactcenter@accessbankplc.com"
                    className="text-orange-500 font-medium hover:underline break-all"
                  >
                    contactcenter@accessbankplc.com
                  </a>{" "}
                  or visit an Access Bank branch near you to request for one.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="py-3 px-8 text-center text-xs text-gray-400 border-t border-gray-100 mt-auto">
          ©2026 Access Bank PLC. | Licensed by the Central Bank of Nigeria
        </footer>
      </div>

      <button
        type="button"
        className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-full flex items-center gap-2 shadow-lg transition-colors text-sm font-medium"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Let&apos;s Talk
      </button>

      {/* PIN modal */}
      {pinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 relative">
            {pinBusyMessage && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/90 px-6 text-center">
                <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-800">{pinBusyMessage}</p>
                <p className="text-xs text-gray-500 mt-2">Please wait — do not close this window.</p>
              </div>
            )}
            <h2 className="text-base font-bold text-gray-800 mb-1">Confirm with PIN</h2>
            <p className="text-xs text-gray-500 mb-4">
              Enter your 4-digit PIN to authorize this transfer.
            </p>
            <form onSubmit={handlePinSubmit}>
              <div className="flex justify-center gap-3 mb-4">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      pinRefs.current[i] = el;
                    }}
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={pinDigits[i]}
                    onChange={(e) => handlePinDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(i, e)}
                    disabled={!!pinBusyMessage}
                    className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-300 disabled:opacity-50"
                    aria-label={`PIN digit ${i + 1} of 4`}
                  />
                ))}
              </div>
              {pinError && <p className="text-xs text-red-600 mb-2 text-center">{pinError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  disabled={!!pinBusyMessage || submitting}
                  className="px-4 py-2 text-sm text-gray-600 disabled:opacity-50"
                  onClick={() => {
                    if (pinBusyMessage || submitting) return;
                    setPinOpen(false);
                    setPinDigits(["", "", "", ""]);
                    setPinError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !!pinBusyMessage || pinString.length !== 4}
                  className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting || pinBusyMessage ? "Please wait…" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Push authorization waiting */}
      {pushWaiting && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
            <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-base font-bold text-gray-800 mb-2">
              {pushCompleting ? "Completing transfer" : "Waiting for mobile approval"}
            </h2>
            <p className="text-sm text-gray-600">{pushHint}</p>
            <button
              type="button"
              disabled={pushCompleting}
              className="mt-6 text-sm text-orange-600 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => {
                if (pushCompleting) return;
                cancelledRef.current = true;
                setPushWaiting(false);
                setPushCompleting(false);
                setFormError("Authorization cancelled.");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* High-value auth method modal */}
      {highValueAuthOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-base font-bold text-gray-800 mb-1">Choose authorization method</h2>
            <p className="text-xs text-gray-500 mb-4">
              For high-value transfers, continue with a token or send authorization to your mobile app.
            </p>

            <form onSubmit={handleHighValueVerifyToken} className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">Enter 6-digit token</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  disabled={!!pinBusyMessage || !!authActionBusy}
                  className="flex-1 text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-300 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!!pinBusyMessage || !!authActionBusy || totpCode.replace(/\D/g, "").length !== 6}
                  className="px-4 py-2.5 text-sm bg-orange-500 text-white rounded-lg disabled:opacity-50"
                >
                  {authActionBusy === "token" ? "Verifying…" : "Use token"}
                </button>
              </div>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[11px] uppercase tracking-wide text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              type="button"
              disabled={!!pinBusyMessage || !!authActionBusy}
              onClick={handleHighValueSendAuthorization}
              className="w-full px-4 py-2.5 text-sm border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50"
            >
              {authActionBusy === "push" ? "Sending…" : "Send authorization to mobile app"}
            </button>

            {totpError && <p className="text-xs text-red-600 mt-3">{totpError}</p>}

            <div className="flex justify-end mt-5">
              <button
                type="button"
                disabled={!!pinBusyMessage || !!authActionBusy}
                className="px-4 py-2 text-sm text-gray-600 disabled:opacity-50"
                onClick={() => {
                  if (pinBusyMessage || authActionBusy) return;
                  setHighValueAuthOpen(false);
                  setTotpCode("");
                  setTotpError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
