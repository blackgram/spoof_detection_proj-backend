"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccessLogo from "@/components/AccessLogo";
import { useAuth } from "@/context/AuthContext";

function formatNgn(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (name.slice(0, 2) || "??").toUpperCase();
}

const NAV_ITEMS = [
  {
    label: "Home",
    active: true,
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
      </svg>
    ),
  },
  {
    label: "Beneficiaries",
    active: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    active: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: "Support",
    active: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: "Profile Settings",
    active: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const ACCOUNT_ACTIONS = [
  {
    label: "Transaction History",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    label: "Generate Statement",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: "Signed Statement",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Letter of non Indebtedness",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    label: "Beneficiaries",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Token Request/Activation",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const TRANSFER_ACTIONS = [
  {
    label: "Access\nTransfers",
    href: "#",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    label: "Other Banks\nTransfer",
    href: "/home/transfer/other-banks",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="14" fill="#F97316" />
        <path d="M14 8a3 3 0 100 6 3 3 0 000-6z" fill="white" />
        <path d="M8 20c0-3.314 2.686-5 6-5h1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17 17l2.5-2.5M19.5 14.5L22 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Foreign\nCurrency",
    href: "#",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Access Africa",
    href: "#",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Access Bulk\nTransfer",
    href: "#",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: "Other Banks\nBulk Transfer",
    href: "#",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    label: "Scheduled\nTransfers",
    href: "#",
    icon: (
      <svg className="w-7 h-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const TABS = [
  "Account",
  "Transfers",
  "Mobile Topup",
  "Bill Payments",
  "Lifestyle",
  "Cheques & Cards",
];

export default function HomePage() {
  const router = useRouter();
  const { user, ready, logout, refreshAccounts } = useAuth();
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("Account");
  const [showFeedback, setShowFeedback] = useState(true);

  useEffect(() => {
    if (ready && !user) {
      router.replace("/");
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (user?.customer_id) {
      void refreshAccounts();
    }
    // Intentionally only when customer_id changes; refreshAccounts updates user and would retrigger if listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync balances once per session customer
  }, [user?.customer_id]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const primary = user.accounts[0];
  const displayName = firstName(user.name);
  const avatarInitials = initialsFromName(user.name);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col py-0 min-h-screen shadow-sm">
        {/* Logo area */}
        <div className="px-5 py-5 border-b border-gray-100">
          <AccessLogo className="h-7 w-auto" />
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors ${
                item.active
                  ? "text-orange-500 bg-orange-50 border-r-2 border-orange-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className={item.active ? "text-orange-500" : "text-gray-400"}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
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

        {/* Feedback popup */}
        {showFeedback && (
          <div className="m-3 mb-4 bg-gray-50 border border-gray-200 rounded-xl p-3 relative">
            {/* close */}
            <button
              onClick={() => setShowFeedback(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* little illustration */}
            <div className="flex justify-center mb-2">
              <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="#FEF3E2" />
                <path d="M24 12c-6.6 0-12 5.4-12 12s5.4 12 12 12 12-5.4 12-12-5.4-12-12-12zm0 4c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm0 17c-3 0-5.7-1.5-7.4-3.8.6-2.4 4.8-3.7 7.4-3.7 2.6 0 6.8 1.3 7.4 3.7C29.7 31.5 27 33 24 33z" fill="#E8761A" />
              </svg>
            </div>
            <p className="text-xs text-gray-600 text-center font-medium leading-snug">
              Like our new platform?
            </p>
            <button className="mt-2 w-full bg-gray-900 text-white text-xs py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors">
              Click here to tell us
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen overflow-auto">
        {/* Top header bar */}
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">
            Hello, {displayName}{" "}
            <span role="img" aria-label="wave">
              👋
            </span>
          </h1>
          <div className="flex items-center gap-3">
            {/* Bell */}
            <button className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
            </button>
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
              {avatarInitials}
            </div>
            <span className="text-sm font-medium text-gray-700">{user.name}</span>
          </div>
        </header>

        <div className="flex-1 px-8 py-6">
          {/* Top section: orange card + recent transfers */}
          <div className="flex gap-6 mb-6">
            {/* Orange account card */}
            <div
              className="rounded-2xl p-5 text-white flex flex-col gap-3 min-w-[280px]"
              style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
            >
              {/* Account type */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium opacity-90">Regular</span>
              </div>
              <p className="text-sm font-semibold tracking-widest opacity-90">
                {primary?.account_number ?? "—"}
              </p>

              {/* Account type badge */}
              <div className="flex items-center justify-between bg-white bg-opacity-20 rounded-full px-3 py-1.5">
                <span className="text-sm font-medium capitalize">
                  {(primary?.account_type ?? "current").replace(/_/g, " ")} account
                </span>
                <div className="w-8 h-4 bg-white rounded-full flex items-center justify-end pr-0.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-orange-400" />
                </div>
              </div>

              {/* Balance */}
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-wider">
                  {balanceVisible && primary
                    ? `₦${formatNgn(primary.balance_ngn)}`
                    : "N****"}
                </span>
                <button
                  onClick={() => setBalanceVisible((v) => !v)}
                  className="opacity-80 hover:opacity-100 transition-opacity"
                >
                  {balanceVisible ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 mt-1">
                <button className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-xs opacity-90">Pay bills</span>
                </button>
                <button
                  onClick={() => setActiveTab("Transfers")}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <span className="text-xs opacity-90">Transfer</span>
                </button>
              </div>
            </div>

            {/* Most recent transfers */}
            <div className="flex-1 bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Most Recent Transfers</h2>
              <div className="flex items-center gap-3 py-2">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                  AT
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Ajirioghene</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 mb-6 gap-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-orange-400 text-orange-500 bg-orange-50 rounded-t"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Account section */}
          {activeTab === "Account" && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Account</h2>
              <div className="grid grid-cols-5 gap-4">
                {ACCOUNT_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    className="bg-white rounded-xl p-5 flex flex-col items-start gap-3 shadow-sm hover:shadow-md transition-shadow border border-gray-50 text-left"
                  >
                    <div className="p-2 bg-orange-50 rounded-lg">{action.icon}</div>
                    <span className="text-xs font-medium text-gray-700 leading-snug">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transfers section */}
          {activeTab === "Transfers" && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Transfers</h2>
              <div className="grid grid-cols-5 gap-4">
                {TRANSFER_ACTIONS.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="bg-white rounded-xl p-5 flex flex-col items-start gap-3 shadow-sm hover:shadow-md transition-shadow border border-gray-50 text-left"
                  >
                    <div className="p-2 bg-orange-50 rounded-lg">{action.icon}</div>
                    <span className="text-xs font-medium text-gray-700 leading-snug whitespace-pre-line">
                      {action.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Placeholder for other tabs */}
          {!["Account", "Transfers"].includes(activeTab) && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              {activeTab} — coming soon
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="py-3 px-8 text-center text-xs text-gray-400 border-t border-gray-100 mt-auto">
          ©2026 Access Bank PLC. | Licensed by the Central Bank of Nigeria
        </footer>
      </div>

      {/* Let's Talk floating button */}
      <button className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-full flex items-center gap-2 shadow-lg transition-colors text-sm font-medium">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Let&apos;s Talk
      </button>
    </div>
  );
}
