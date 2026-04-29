import { Shield, Plus } from 'lucide-react';
import AccessLogo from '../../Access_logo1.png';

type EmptyStateProps = {
  onAddToken: () => void;
};

export function EmptyState({ onAddToken }: EmptyStateProps) {
  return (
    <div className="size-full flex flex-col bg-background relative overflow-hidden">
      {/* Logo Watermark Background */}
      <div className="absolute -right-8 -bottom-8 pointer-events-none select-none overflow-hidden">
        <img src={AccessLogo} alt="" className="w-64 h-64 object-contain opacity-[0.06] grayscale" />
      </div>

      <div className="px-4 py-4 bg-card border-b border-border">
        <h1 className="text-xl font-medium text-foreground">Access Token</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
        <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-accent mb-5">
          <Shield className="w-10 h-10 text-primary" strokeWidth={2} />
        </div>

        <h2 className="text-lg font-medium text-foreground mb-2">
          No tokens yet
        </h2>

        <p className="text-sm text-muted-foreground text-center max-w-[280px]">
          Add a security token to protect your accounts
        </p>
      </div>

      <div className="p-4 bg-card border-t border-border">
        <button
          onClick={onAddToken}
          className="w-full h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-2 font-medium text-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          Add token
        </button>
      </div>
    </div>
  );
}
