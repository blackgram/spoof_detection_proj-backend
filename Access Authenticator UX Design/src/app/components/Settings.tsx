import { ArrowLeft, ChevronRight, Globe, Languages, Shield, Info, Moon, Sun, Monitor } from 'lucide-react';

type SettingsProps = {
  onBack: () => void;
  country: string;
  language: string;
  onCountryChange: (country: string) => void;
  onLanguageChange: (language: string) => void;
  themeMode: 'system' | 'light' | 'dark';
  onThemeModeChange: (mode: 'system' | 'light' | 'dark') => void;
};

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'pt', name: 'Português' },
  { code: 'es', name: 'Español' },
  { code: 'ar', name: 'العربية' },
];

const THEME_OPTIONS = [
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

export function Settings({ onBack, country, language, onCountryChange, onLanguageChange, themeMode, onThemeModeChange }: SettingsProps) {
  return (
    <div className="size-full flex flex-col bg-background">
      <div className="px-4 py-4 bg-card border-b border-border flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
        </button>
        <h1 className="text-xl font-medium text-foreground">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Appearance Section */}
        <div className="p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
            Appearance
          </h2>

          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm font-medium text-foreground mb-3">Theme</div>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = themeMode === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => onThemeModeChange(option.value)}
                    className={`flex-1 py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all text-sm font-medium ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Localization Section */}
        <div className="p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
            Localization
          </h2>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {/* Country Selector */}
            <button className="w-full p-4 flex items-center gap-3 transition-all active:scale-[0.98] hover:bg-accent border-b border-border">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Globe className="w-5 h-5 text-primary" strokeWidth={2} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground mb-0.5">Country</div>
                <div className="text-xs text-muted-foreground">
                  {COUNTRIES.find(c => c.code === country)?.flag} {COUNTRIES.find(c => c.code === country)?.name || 'Select country'}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
            </button>

            {/* Language Selector */}
            <button className="w-full p-4 flex items-center gap-3 transition-all active:scale-[0.98] hover:bg-accent">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Languages className="w-5 h-5 text-secondary" strokeWidth={2} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground mb-0.5">Language</div>
                <div className="text-xs text-muted-foreground">
                  {LANGUAGES.find(l => l.code === language)?.name || 'Select language'}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Security Section */}
        <div className="p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
            Security
          </h2>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <button className="w-full p-4 flex items-center gap-3 transition-all active:scale-[0.98] hover:bg-accent">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" strokeWidth={2} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground mb-0.5">Biometric Security</div>
                <div className="text-xs text-muted-foreground">Manage biometric settings</div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* About Section */}
        <div className="p-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
            About
          </h2>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <button className="w-full p-4 flex items-center gap-3 transition-all active:scale-[0.98] hover:bg-accent">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Info className="w-5 h-5 text-primary" strokeWidth={2} />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-foreground mb-0.5">App Information</div>
                <div className="text-xs text-muted-foreground">Version 1.0.0</div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
