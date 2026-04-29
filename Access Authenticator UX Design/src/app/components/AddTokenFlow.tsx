import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, QrCode, Keyboard, Building2, Briefcase, User, Wallet, Check, Camera, ChevronDown, X } from 'lucide-react';
import type { Token } from '../App';

function FloatingInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  isCode = false
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  isCode?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const active = focused || !!value;

  return (
    <div className="relative h-14 mb-5">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder=" "
        className={`absolute inset-0 w-full h-full border-2 outline-none px-4 pt-4 bg-muted rounded-lg transition-colors ${
          focused ? 'border-primary' : 'border-input'
        } ${isCode ? 'font-mono tracking-widest' : ''} text-foreground text-sm`}
      />
      <label
        className={`absolute left-4 pointer-events-none transition-all duration-180 ${
          active ? 'top-2 text-xs text-primary font-medium' : 'top-1/2 -translate-y-1/2 text-sm text-muted-foreground'
        } ${focused ? 'text-primary' : 'text-muted-foreground'}`}
      >
        {label}
      </label>
    </div>
  );
}

type AddTokenFlowProps = {
  step: 'method' | 'qr' | 'manual';
  onAddToken: (token: Token) => void;
  onBack: () => void;
  onChangeStep: (step: 'method' | 'qr' | 'manual') => void;
};

const DEMO_TOKENS = [
  {
    name: 'ayomide@accessbank.com',
    issuer: 'Access Bank',
    color: '#003883',
    icon: 'user',
    type: 'Corporate',
  },
  {
    name: 'customer@primus.com',
    issuer: 'PrimusPlus',
    color: '#FF8200',
    icon: 'briefcase',
    type: 'Corporate',
  },
  {
    name: 'sarah@accessmore.com',
    issuer: 'AccessMore',
    color: '#10B981',
    icon: 'wallet',
    type: 'Retail',
  },
  {
    name: 'admin@company.com',
    issuer: 'Enterprise',
    color: '#8B5CF6',
    icon: 'building',
    type: 'Corporate',
  },
  {
    name: 'user@sme.com',
    issuer: 'SME',
    color: '#EC4899',
    icon: 'briefcase',
    type: 'Corporate',
  },
  {
    name: 'retail@customer.com',
    issuer: 'Access More',
    color: '#14B8A6',
    icon: 'wallet',
    type: 'Retail',
  },
];

const iconOptions = [
  { value: 'building', Icon: Building2 },
  { value: 'briefcase', Icon: Briefcase },
  { value: 'user', Icon: User },
  { value: 'wallet', Icon: Wallet },
];

const colorOptions = [
  '#003883',
  '#FF8200',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F59E0B',
  '#EF4444',
];

const ISSUERS = [
  { code: 'accessbank', name: 'Access Bank' },
  { code: 'accesssme', name: 'Access SME' },
  { code: 'primusplus', name: 'Primus Plus' },
];

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
    {children}
    {isSelected && <Check className="w-4 h-4 text-primary" />}
  </button>
);

export function AddTokenFlow({ step, onAddToken, onBack, onChangeStep }: AddTokenFlowProps) {
  const [selectedDemo, setSelectedDemo] = useState<number | null>(null);
  const [selectedIcon, setSelectedIcon] = useState('building');
  const [selectedColor, setSelectedColor] = useState('#003883');
  const [selectedTokenType, setSelectedTokenType] = useState<'Corporate' | 'Retail'>('Corporate');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success'>('idle');
  const [manualName, setManualName] = useState('');
  const [manualIssuer, setManualIssuer] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [showIssuerPicker, setShowIssuerPicker] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 'qr' && scanStatus === 'idle') {
      setScanStatus('scanning');
      const timer = setTimeout(() => {
        setScanStatus('success');
        setSelectedDemo(1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleCodeChange = (code: string) => {
    setManualCode(code);
    if (code.length >= 4) {
      const codeLower = code.toLowerCase();
      if (codeLower.includes('sme')) {
        setManualIssuer('accesssme');
        setSelectedTokenType('Corporate');
      } else if (codeLower.includes('primus') || codeLower.includes('plus')) {
        setManualIssuer('primusplus');
        setSelectedTokenType('Corporate');
      } else {
        setManualIssuer('accessbank');
        setSelectedTokenType('Corporate');
      }
      if (!manualName) {
        setManualName('user@accessbank.com');
      }
    }
  };

  const selectedIssuer = ISSUERS.find(i => i.code === manualIssuer);

  if (step === 'method') {
    return (
      <div className="size-full flex flex-col bg-background">
        <div className="px-4 py-4 bg-card border-b border-border flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
          </button>
          <h1 className="text-xl font-medium text-foreground">Add token</h1>
        </div>

        <div className="flex-1 flex flex-col p-4">
          <p className="text-sm text-muted-foreground mb-5">
            Choose how to add your token
          </p>

          <div className="space-y-3">
            <button
              onClick={() => onChangeStep('qr')}
              className="w-full bg-card rounded-lg border border-border p-4 flex items-center gap-4 transition-all active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                <QrCode className="w-6 h-6 text-primary" strokeWidth={2} />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-foreground text-sm">Scan QR Code</div>
              </div>
            </button>

            <button
              onClick={() => onChangeStep('manual')}
              className="w-full bg-card rounded-lg border border-border p-4 flex items-center gap-4 transition-all active:scale-[0.98]"
            >
              <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Keyboard className="w-6 h-6 text-secondary" strokeWidth={2} />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-foreground mb-0.5 text-sm">Enter manually</div>
                <div className="text-xs text-muted-foreground">Use if you have activation code</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'qr') {
    return (
      <div className="size-full flex flex-col bg-background">
        <style>{`
          @keyframes scan {
            0% { top: 0%; }
            100% { top: 100%; }
          }
          @keyframes bounce-in {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes fade-in {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          .animate-scan {
            animation: scan 1.5s ease-in-out infinite;
          }
          .animate-bounce-in {
            animation: bounce-in 0.5s ease-out forwards;
          }
          .animate-fade-in {
            animation: fade-in 0.4s ease-out 0.2s forwards;
            opacity: 0;
          }
          .animate-fade-in-delay {
            animation: fade-in 0.4s ease-out 0.4s forwards;
            opacity: 0;
          }
        `}</style>
        <div className="px-4 py-4 bg-card border-b border-border flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
          </button>
          <h1 className="text-xl font-medium text-foreground">Add token</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {scanStatus === 'scanning' && (
            <>
              <div className="w-64 h-64 bg-black rounded-2xl relative overflow-hidden mb-6">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/10 to-transparent animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="w-16 h-16 text-white/30" />
                </div>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 256">
                  <path d="M48 48 L48 80 L80 48" fill="none" stroke="#003883" strokeWidth="6" strokeLinecap="round" className="animate-pulse" />
                  <path d="M208 48 L208 80 L176 48" fill="none" stroke="#003883" strokeWidth="6" strokeLinecap="round" className="animate-pulse" />
                  <path d="M48 208 L48 176 L80 208" fill="none" stroke="#003883" strokeWidth="6" strokeLinecap="round" className="animate-pulse" />
                  <path d="M208 208 L208 176 L176 208" fill="none" stroke="#003883" strokeWidth="6" strokeLinecap="round" className="animate-pulse" />
                </svg>
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-primary/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-primary/20 to-transparent" />
              </div>
              <p className="text-sm text-muted-foreground text-center animate-pulse">
                Point camera at QR code to scan
              </p>
              <div className="flex gap-1 mt-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </>
          )}

          {scanStatus === 'success' && (
            <>
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-4 animate-bounce-in">
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-10 h-10 text-white" strokeWidth={3} />
                </div>
              </div>
              <p className="text-lg font-medium text-foreground mb-2 animate-fade-in">QR Code Scanned!</p>
              <p className="text-sm text-muted-foreground text-center mb-6 animate-fade-in-delay">
                SME Corporate token detected
              </p>
            </>
          )}

          {scanStatus === 'success' && (
            <button
              onClick={() => {
                const demo = DEMO_TOKENS[1];
                onAddToken({
                  id: Date.now().toString(),
                  name: demo.name,
                  issuer: demo.issuer,
                  secret: Math.random().toString(36).substring(7),
                  color: demo.color,
                  icon: demo.icon,
                  createdAt: Date.now(),
                  tokenType: demo.type,
                });
              }}
              className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-all active:scale-[0.98]"
            >
              Activate Token
            </button>
          )}

          <p className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded-lg mt-4">
            ⚠️ Activation code expires in 10 minutes
          </p>
        </div>
      </div>
    );
  }

  if (step === 'manual') {
    return (
      <div className="size-full flex flex-col bg-background">
        <div className="px-4 py-4 bg-card border-b border-border flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
          </button>
          <h1 className="text-xl font-medium text-foreground">Enter details</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            <FloatingInput
              label="Activation code"
              value={manualCode}
              onChange={handleCodeChange}
              placeholder="XXXX-XXXX-XXXX"
              isCode
            />

            <FloatingInput
              label="Account email/name"
              value={manualName}
              onChange={setManualName}
              placeholder="user@example.com"
            />

            <div className="relative">
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Issuer
              </label>
              <button
                onClick={() => setShowIssuerPicker(true)}
                className="w-full h-14 bg-muted border-2 border-input rounded-lg px-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-primary" strokeWidth={2} />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-foreground">
                    {selectedIssuer?.name || 'Select issuer'}
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Token Type
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTokenType('Corporate')}
                  className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-all ${
                    selectedTokenType === 'Corporate'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  Corporate
                </button>
                <button
                  onClick={() => setSelectedTokenType('Retail')}
                  className={`flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-all ${
                    selectedTokenType === 'Retail'
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  Retail
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3 bg-muted/50 p-3 rounded-lg">
              <strong>Note:</strong> This token is linked to your device. Reinstalling the app or changing devices will require new token activation.
            </p>

            {showIssuerPicker && (
              <div className="fixed left-0 right-0 bottom-0 bg-card border-t border-border rounded-t-2xl z-50 animate-in slide-in-from-bottom duration-300">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-medium text-foreground">Select Issuer</h3>
                  <button onClick={() => setShowIssuerPicker(false)}>
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto pb-8">
                  {ISSUERS.map((issuer) => (
                    <BottomSheetItem
                      key={issuer.code}
                      isSelected={issuer.code === manualIssuer}
                      onSelect={() => { setManualIssuer(issuer.code); setShowIssuerPicker(false); }}
                    >
                      <span>{issuer.name}</span>
                    </BottomSheetItem>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Icon
              </label>
              <div className="grid grid-cols-4 gap-2">
                {iconOptions.map(({ value, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedIcon(value)}
                    className={`h-12 rounded-md border transition-all active:scale-95 flex items-center justify-center ${
                      selectedIcon === value
                        ? 'border-primary bg-accent'
                        : 'border-border bg-card'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Color
              </label>
              <div className="grid grid-cols-4 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`h-11 rounded-md transition-all active:scale-95 ${
                      selectedColor === color ? 'ring-2 ring-offset-2 ring-foreground' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-card border-t border-border">
          <button
            onClick={() => {
              if (manualName && manualIssuer && manualCode) {
                onAddToken({
                  id: Date.now().toString(),
                  name: manualName,
                  issuer: manualIssuer,
                  secret: manualCode,
                  color: selectedColor,
                  icon: selectedIcon,
                  createdAt: Date.now(),
                  tokenType: selectedTokenType,
                });
              }
            }}
            disabled={!manualName || !manualIssuer || !manualCode}
            className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add token
          </button>
        </div>
      </div>
    );
  }

  return null;
}
