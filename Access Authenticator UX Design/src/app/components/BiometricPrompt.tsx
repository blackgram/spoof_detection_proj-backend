import { useState, useEffect } from 'react';
import { Fingerprint, X } from 'lucide-react';

type BiometricPromptProps = {
  onSuccess: () => void;
  onCancel: () => void;
};

export function BiometricPrompt({ onSuccess, onCancel }: BiometricPromptProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsAuthenticating(true);
    }, 500);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (isAuthenticating) {
      const timeout = setTimeout(() => {
        onSuccess();
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [isAuthenticating, onSuccess]);

  return (
    <div className="size-full flex flex-col bg-background">
      <div className="px-4 py-4 bg-card border-b border-border flex items-center justify-between">
        <h1 className="text-xl font-medium text-foreground">Access Token</h1>
        <button
          onClick={onCancel}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 hover:bg-accent"
        >
          <X className="w-5 h-5 text-foreground" strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="relative mb-6">
          <div
            className={`w-20 h-20 rounded-2xl bg-accent flex items-center justify-center transition-all duration-500 ${
              isAuthenticating ? 'scale-110' : 'scale-100'
            }`}
          >
            <Fingerprint className="w-12 h-12 text-primary" strokeWidth={1.5} />
          </div>

          {isAuthenticating && (
            <div className="absolute inset-0 rounded-2xl border-4 border-primary animate-ping opacity-75" />
          )}
        </div>

        <h2 className="text-lg font-medium text-foreground mb-2">
          {isAuthenticating ? 'Authenticating...' : 'Verify identity'}
        </h2>

        <p className="text-sm text-muted-foreground text-center max-w-[280px]">
          {isAuthenticating
            ? 'Confirming biometric data'
            : 'Use fingerprint or Face ID to continue'}
        </p>
      </div>

      <div className="p-4 bg-card border-t border-border">
        <button
          onClick={onCancel}
          className="w-full h-12 rounded-lg bg-card border border-border text-foreground font-medium text-sm transition-all active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
