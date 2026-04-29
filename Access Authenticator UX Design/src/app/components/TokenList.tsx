import { useState, useEffect } from 'react';
import { Plus, Lock, RefreshCw, MoreVertical, Globe, ChevronDown, X, Check, Copy } from 'lucide-react';
import type { Token } from '../App';
import { generateTOTP, getTimeRemaining } from '../utils/totp';
import AccessLogo from '../../Access_logo1.png';

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', flag: 'ng' },
  { code: 'GH', name: 'Ghana', flag: 'gh' },
  { code: 'KE', name: 'Kenya', flag: 'ke' },
  { code: 'ZA', name: 'South Africa', flag: 'za' },
  { code: 'US', name: 'United States', flag: 'us' },
  { code: 'GB', name: 'United Kingdom', flag: 'gb' },
];

const LANGUAGES = [
  { code: 'en', name: 'English', flag: 'gb' },
  { code: 'fr', name: 'Français', flag: 'fr' },
  { code: 'pt', name: 'Português', flag: 'pt' },
  { code: 'es', name: 'Español', flag: 'es' },
];

type TokenListProps = {
  tokens: Token[];
  isLocked: boolean;
  onUnlock: () => void;
  onAddToken: () => void;
  onSelectToken: (token: Token) => void;
  onOpenSettings: () => void;
  country: string;
  language: string;
  onCountryChange: (country: string) => void;
  onLanguageChange: (language: string) => void;
};

const FlagImage = ({ code }: { code: string }) => (
  <img
    src={`https://flagcdn.com/w40/${code}.png`}
    alt=""
    className="w-6 h-4 object-cover rounded-sm"
  />
);

const BottomSheetItem = ({ 
  onSelect, 
  isSelected,
  children 
}: { 
  onSelect: () => void; 
  isSelected: boolean;
  children: React.ReactNode;
}) => (
  <button
    onClick={onSelect}
    className={`w-full px-4 py-3 flex items-center justify-between text-left hover:bg-accent transition-all ${
      isSelected ? 'bg-accent' : ''
    }`}
  >
    <span className={isSelected ? 'text-primary font-medium' : 'text-foreground'}>{children}</span>
    {isSelected && <Check className="w-5 h-5 text-primary" />}
  </button>
);

export function TokenList({ tokens, isLocked, onUnlock, onAddToken, onSelectToken, onOpenSettings, country, language, onCountryChange, onLanguageChange }: TokenListProps) {
  const [time, setTime] = useState(Date.now());
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

if (isLocked) {
    return (
      <div className="size-full flex flex-col bg-background relative overflow-hidden">
        {/* Logo Watermark */}
        <div className="absolute -right-8 -bottom-8 pointer-events-none select-none overflow-hidden">
          <img src={AccessLogo} alt="" className="w-64 h-64 object-contain opacity-[0.06] grayscale" />
        </div>
        
        <div className="px-4 py-4 bg-card border-b border-border">
          <h1 className="text-xl font-medium text-foreground mb-3">Access Token</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCountryPicker(!showCountryPicker)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border hover:bg-accent transition-all"
            >
              <FlagImage code={COUNTRIES.find(c => c.code === country)?.flag || 'ng'} />
              <span className="text-sm text-foreground">
                {COUNTRIES.find(c => c.code === country)?.name}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowLangPicker(!showLangPicker)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border hover:bg-accent transition-all"
            >
              <span className="text-sm font-medium text-foreground">
                {LANGUAGES.find(l => l.code === language)?.name}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>

          {/* Country Bottom Sheet */}
          {showCountryPicker && (
            <div className="fixed left-0 right-0 bottom-0 bg-card border-t border-border rounded-t-2xl z-50 animate-slide-up">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-foreground">Select Country</h3>
                <button onClick={() => setShowCountryPicker(false)}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto pb-8">
                {COUNTRIES.map((c) => (
                  <BottomSheetItem
                    key={c.code}
                    isSelected={c.code === country}
                    onSelect={() => { onCountryChange(c.code); setShowCountryPicker(false); }}
                  >
                    <div className="flex items-center gap-3">
                      <FlagImage code={c.flag} />
                      <span>{c.name}</span>
                    </div>
                  </BottomSheetItem>
                ))}
              </div>
            </div>
          )}

          {/* Language Bottom Sheet */}
          {showLangPicker && (
            <div className="fixed left-0 right-0 bottom-0 bg-card border-t border-border rounded-t-2xl z-50 animate-slide-up">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-foreground">Select Language</h3>
                <button onClick={() => setShowLangPicker(false)}>
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto pb-8">
                {LANGUAGES.map((l) => (
                  <BottomSheetItem
                    key={l.code}
                    isSelected={l.code === language}
                    onSelect={() => { onLanguageChange(l.code); setShowLangPicker(false); }}
                  >
                    <div className="flex items-center gap-3">
                      <FlagImage code={l.flag} />
                      <span>{l.name}</span>
                    </div>
                  </BottomSheetItem>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4">
            <Lock className="w-8 h-8 text-primary" strokeWidth={2} />
          </div>

          <h2 className="text-lg font-medium text-foreground mb-2">
            Tokens Locked
          </h2>

          <p className="text-sm text-muted-foreground text-center max-w-[280px] mb-6">
            Verify your identity to view tokens
          </p>

          <button
            onClick={onUnlock}
            className="h-11 px-6 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-all active:scale-[0.98]"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  const BottomSheetItem = ({ 
  onSelect, 
  isSelected,
  children 
}: { 
  onSelect: () => void; 
  isSelected: boolean;
  children: React.ReactNode;
}) => (
  <button
    onClick={onSelect}
    className={`w-full px-4 py-3 flex items-center justify-between text-left hover:bg-accent transition-all ${
      isSelected ? 'bg-accent' : ''
    }`}
  >
    <span className={isSelected ? 'text-primary font-medium' : 'text-foreground'}>{children}</span>
    {isSelected && <Check className="w-5 h-5 text-primary" />}
  </button>
);

return (
    <div className="size-full flex flex-col bg-background relative overflow-hidden">
      {/* Logo Watermark Background */}
      <div className="absolute -right-8 -bottom-8 pointer-events-none select-none overflow-hidden">
        <img src={AccessLogo} alt="" className="w-64 h-64 object-contain opacity-[0.06] grayscale" />
      </div>

{/* Bottom Sheet Overlay */}
      {(showCountryPicker || showLangPicker) && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => { setShowCountryPicker(false); setShowLangPicker(false); }}
        />
      )}

      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-medium text-foreground">Access Token</h1>
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center transition-all active:scale-95 hover:bg-accent"
          >
            <MoreVertical className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCountryPicker(!showCountryPicker)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border hover:bg-accent transition-all"
          >
            <FlagImage code={COUNTRIES.find(c => c.code === country)?.flag || 'ng'} />
            <span className="text-sm text-foreground">
              {COUNTRIES.find(c => c.code === country)?.name}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border hover:bg-accent transition-all"
          >
            <span className="text-sm font-medium text-foreground">
              {LANGUAGES.find(l => l.code === language)?.name}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>

        {/* Country Bottom Sheet */}
        {showCountryPicker && (
          <div className="fixed left-0 right-0 bottom-0 bg-card border-t border-border rounded-t-2xl z-50 animate-slide-up">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-medium text-foreground">Select Country</h3>
              <button onClick={() => setShowCountryPicker(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pb-8">
              {COUNTRIES.map((c) => (
                <BottomSheetItem
                  key={c.code}
                  isSelected={c.code === country}
                  onSelect={() => { onCountryChange(c.code); setShowCountryPicker(false); }}
                >
                  <div className="flex items-center gap-3">
                    <FlagImage code={c.flag} />
                    <span>{c.name}</span>
                  </div>
                </BottomSheetItem>
              ))}
            </div>
          </div>
        )}

        {/* Language Bottom Sheet */}
        {showLangPicker && (
          <div className="fixed left-0 right-0 bottom-0 bg-card border-t border-border rounded-t-2xl z-50 animate-slide-up">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-medium text-foreground">Select Language</h3>
              <button onClick={() => setShowLangPicker(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto pb-8">
              {LANGUAGES.map((l) => (
                <BottomSheetItem
                  key={l.code}
                  isSelected={l.code === language}
                  onSelect={() => { onLanguageChange(l.code); setShowLangPicker(false); }}
                >
                  <div className="flex items-center gap-3">
                    <FlagImage code={l.flag} />
                    <span>{l.name}</span>
                  </div>
                </BottomSheetItem>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {tokens.map((token) => {
            const code = generateTOTP(token.secret, time);
            const remaining = getTimeRemaining(time);
            const isExpiring = remaining <= 5;

const progress = (remaining / 30) * 100;

              return (
              <button
                key={token.id}
                onClick={() => onSelectToken(token)}
                className="w-full text-left"
              >
                <div className="bg-card rounded-lg p-4 transition-all active:scale-[0.98] border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 mb-2">
                    <div className="text-sm font-medium text-foreground">{token.issuer}</div>
                    {token.tokenType && (
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        token.tokenType === 'Corporate' 
                          ? 'bg-blue-100 text-primary' 
                          : 'bg-orange-100 text-secondary'
                      }`}>
                        {token.tokenType}
                      </span>
                    )}
                  </div>
                  <div className={`text-lg font-bold ${isExpiring ? 'text-secondary' : 'text-primary'}`}>
                    {remaining}s
                  </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">{token.name}</div>
                  
                  <div className="h-1.5 bg-muted/30 rounded-full mb-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        isExpiring ? 'bg-secondary' : 'bg-primary'
                      }`}
                      style={{ 
                        width: `${progress}%`,
                        boxShadow: isExpiring ? '0 0 6px rgba(255,130,0,0.5)' : '0 0 6px rgba(0,56,131,0.4)',
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {code.split('').map((digit, index) => (
                      <div
                        key={index}
                        className={`w-7 h-9 rounded flex items-center justify-center text-2xl tabular-nums ${
                          isExpiring ? 'text-secondary' : 'text-primary'
                        }`}
                        style={{
                          backgroundColor: isExpiring ? '#FFF3E0' : '#E8F0FE',
                        }}
                      >
                        {digit}
                      </div>
                    ))}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(code);
                        setCopiedId(token.id);
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      className="w-9 h-9 rounded flex items-center justify-center transition-all ml-1"
                    >
                      {copiedId === token.id ? (
                        <Check className="w-4 h-4 text-green-500" strokeWidth={3} />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground hover:text-primary" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Add Button */}
      <button
        onClick={onAddToken}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transition-all active:scale-95 hover:scale-105 z-30"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
