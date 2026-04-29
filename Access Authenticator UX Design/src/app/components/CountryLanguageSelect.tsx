import { useState } from 'react';
import { Globe, Languages, Check, ChevronDown, X } from 'lucide-react';

type CountryLanguageSelectProps = {
  onComplete: (country: string, language: string) => void;
};

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
    {children}
    {isSelected && <Check className="w-4 h-4 text-primary" />}
  </button>
);

export function CountryLanguageSelect({ onComplete }: CountryLanguageSelectProps) {
  const [country, setCountry] = useState('NG');
  const [language, setLanguage] = useState('en');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const selectedCountry = COUNTRIES.find(c => c.code === country);
  const selectedLanguage = LANGUAGES.find(l => l.code === language);

  return (
    <div className="size-full flex flex-col bg-background">
      <div className="flex-1 flex flex-col p-4">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Welcome
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Select your country and language to get started
        </p>

        <div className="space-y-4">
          <div className="relative">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Country
            </label>
            <button
              onClick={() => setShowCountryPicker(true)}
              className="w-full h-14 bg-card border border-border rounded-lg px-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <FlagImage code={selectedCountry?.flag || 'ng'} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground">
                  {selectedCountry?.name}
                </div>
              </div>
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="relative">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Language
            </label>
            <button
              onClick={() => setShowLangPicker(true)}
              className="w-full h-14 bg-card border border-border rounded-lg px-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <FlagImage code={selectedLanguage?.flag || 'gb'} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground">
                  {selectedLanguage?.name}
                </div>
              </div>
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 bg-card border-t border-border">
        <button
          onClick={() => onComplete(country, language)}
          className="w-full h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-2 font-medium text-sm transition-all active:scale-[0.98]"
        >
          Continue
        </button>
      </div>

      {showCountryPicker && (
        <div className="fixed left-0 right-0 bottom-0 bg-card border-t border-border rounded-t-2xl z-50 animate-in slide-in-from-bottom duration-300">
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
                onSelect={() => { setCountry(c.code); setShowCountryPicker(false); }}
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

      {showLangPicker && (
        <div className="fixed left-0 right-0 bottom-0 bg-card border-t border-border rounded-t-2xl z-50 animate-in slide-in-from-bottom duration-300">
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
                onSelect={() => { setLanguage(l.code); setShowLangPicker(false); }}
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
  );
}