import { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Trash2, Check } from 'lucide-react';
import type { Token } from '../App';
import { generateTOTP, getTimeRemaining } from '../utils/totp';

type TokenDetailProps = {
  token: Token;
  onBack: () => void;
  onDelete: () => void;
};

export function TokenDetail({ token, onBack, onDelete }: TokenDetailProps) {
  const [time, setTime] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const code = generateTOTP(token.secret, time);
  const remaining = getTimeRemaining(time);
  const progress = (remaining / 30) * 100;
  const isExpiring = remaining <= 5;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showDeleteConfirm) {
    return (
      <div className="size-full flex flex-col bg-background">
        <div className="px-4 py-4 bg-card border-b border-border flex items-center gap-3">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
          </button>
          <h1 className="text-xl font-medium text-foreground">Delete token</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <Trash2 className="w-8 h-8 text-destructive" strokeWidth={2} />
          </div>

          <h2 className="text-lg font-medium text-foreground mb-2">
            Delete this token?
          </h2>

          <p className="text-sm text-muted-foreground text-center max-w-[280px] mb-1">
            This action cannot be undone
          </p>

          <p className="text-xs font-medium text-foreground">
            {token.issuer} ({token.name})
          </p>
        </div>

        <div className="p-4 bg-card border-t border-border space-y-2">
          <button
            onClick={onDelete}
            className="w-full h-12 rounded-lg bg-destructive text-destructive-foreground font-medium text-sm transition-all active:scale-[0.98]"
          >
            Delete
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="w-full h-12 rounded-lg bg-white border border-border text-foreground font-medium text-sm transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-background">
      <div className="px-4 py-4 bg-card border-b border-border flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
        </button>
        <h1 className="text-xl font-medium text-foreground">Token details</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Main Token Card */}
        <div className="bg-card rounded-lg p-6 mb-4 border border-border">
          <div className="flex flex-col items-center">
            {/* Brand Icon */}
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center mb-4 text-white font-bold text-xl"
              style={{ backgroundColor: token.color }}
            >
              {token.issuer.charAt(0).toUpperCase()}
            </div>

            {/* Account Info */}
            <h2 className="text-base font-medium text-foreground mb-1">{token.issuer}</h2>
            <p className="text-xs text-muted-foreground mb-6">{token.name}</p>

            {/* Token Code - Individual Digits Large */}
            <div className="flex items-center gap-2 mb-6">
              {code.split('').map((digit, index) => (
                <div
                  key={index}
                  className={`w-10 h-14 rounded-lg flex items-center justify-center text-3xl font-normal tabular-nums ${
                    isExpiring ? 'text-secondary' : 'text-primary'
                  }`}
                  style={{
                    backgroundColor: isExpiring ? '#FFF3E0' : '#E8F0FE',
                    fontWeight: 400
                  }}
                >
                  {digit}
                </div>
              ))}
            </div>

            {/* Animated Countdown Timer */}
            <div className="relative w-24 h-24 mb-8 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/30"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray="283"
                  strokeDashoffset={283 * (1 - progress / 100)}
                  strokeLinecap="round"
                  className={`transition-all duration-200 ${
                    isExpiring ? 'text-secondary' : 'text-primary'
                  }`}
                  style={{
                    filter: isExpiring ? 'drop-shadow(0 0 4px rgba(255,130,0,0.4))' : 'drop-shadow(0 0 4px rgba(0,56,131,0.3))',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`text-3xl font-bold tabular-nums ${
                  isExpiring ? 'text-secondary' : 'text-primary'
                }`}>
                  {remaining}
                </div>
              </div>
              <div className={`absolute -bottom-6 left-0 right-0 text-center text-xs uppercase tracking-widest ${
                isExpiring ? 'text-secondary' : 'text-muted-foreground'
              }`}>
                seconds
              </div>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" strokeWidth={2} />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" strokeWidth={2} />
                  Copy code
                </>
              )}
            </button>
          </div>
        </div>

        {/* Token Info */}
        <div className="bg-card rounded-lg p-4 mb-4 border border-border">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Account</div>
              <div className="text-sm text-foreground">{token.name}</div>
            </div>
            <div className="h-px bg-border" />
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Issuer</div>
              <div className="text-sm text-foreground">{token.issuer}</div>
            </div>
            <div className="h-px bg-border" />
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Created</div>
              <div className="text-sm text-foreground">
                {new Date(token.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full h-12 rounded-lg bg-red-50 text-destructive font-medium text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
          Delete token
        </button>
      </div>
    </div>
  );
}
