import { useState, useEffect } from 'react';
import { EmptyState } from './components/EmptyState';
import { TokenList } from './components/TokenList';
import { AddTokenFlow } from './components/AddTokenFlow';
import { BiometricPrompt } from './components/BiometricPrompt';
import { TokenDetail } from './components/TokenDetail';
import { Settings } from './components/Settings';
import { CountryLanguageSelect } from './components/CountryLanguageSelect';
import AccessLogo from '../Access_logo1.png';
import { SuccessAnimation } from './components/SuccessAnimation';

export type Token = {
  id: string;
  name: string;
  issuer: string;
  secret: string;
  color: string;
  icon: string;
  createdAt: number;
  tokenType?: 'Corporate' | 'Retail';
};

type Screen =
  | { type: 'empty' }
  | { type: 'list' }
  | { type: 'add-token'; step: 'method' | 'qr' | 'manual' }
  | { type: 'biometric'; onSuccess: () => void }
  | { type: 'detail'; token: Token }
  | { type: 'settings' }
  | { type: 'onboarding' };

function OnboardingSuccessScreen({ onContinue }: { onContinue: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onContinue, 2500);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className="size-full flex flex-col items-center justify-center bg-background p-6">
      <style>{`
        @keyframes success-pop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-success-pop {
          animation: success-pop 0.5s ease-out forwards;
        }
        .animate-fade-up {
          animation: fade-up 0.4s ease-out 0.3s forwards;
          opacity: 0;
        }
      `}</style>
      <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-success-pop">
        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-foreground mb-2 animate-fade-up">
        You're all set!
      </h1>
      <p className="text-sm text-muted-foreground text-center animate-fade-up" style={{ animationDelay: '0.4s' }}>
        Get ready to manage your tokens securely
      </p>
    </div>
  );
}

const GlobalLoader = () => (
  <div className="fixed inset-0 bg-white/95 flex items-center justify-center z-[100]">
    <div className="flex flex-col items-center gap-6">
      <img
        src={AccessLogo}
        alt="Access"
        className="w-20 h-20 object-contain animate-pulse"
      />
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export default function App() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [screen, setScreen] = useState<Screen>({ type: 'empty' });
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [country, setCountry] = useState('NG');
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>('light');
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [onboardingSuccess, setOnboardingSuccess] = useState(false);

  // Set theme class on document
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (themeMode === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [themeMode]);

  // Set mobile viewport
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    }
  }, []);

  // Check if onboarding is complete
  useEffect(() => {
    const savedCountry = localStorage.getItem('access-country');
    const savedLanguage = localStorage.getItem('access-language');
    if (savedCountry && savedLanguage) {
      setCountry(savedCountry);
      setLanguage(savedLanguage);
      setOnboardingComplete(true);
    } else {
      setOnboardingComplete(false);
    }
  }, []);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('access-tokens');
    if (saved) {
      const parsed = JSON.parse(saved);
      setTokens(parsed);
      if (parsed.length > 0) {
        setScreen({ type: 'list' });
        setIsLocked(true);
      }
    }
  }, []);

  // Lock app when user hides tab/changes focus and comes back
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && tokens.length > 0 && !isLocked) {
        // When tab becomes hidden, set last active time
        localStorage.setItem('last-active', Date.now().toString());
      }
      if (document.visibilityState === 'visible') {
        // When user comes back, check if they were away
        const lastActive = localStorage.getItem('last-active');
        if (lastActive && tokens.length > 0 && !isLocked) {
          const timeAway = Date.now() - parseInt(lastActive);
          // Lock after 0 seconds (immediate) - user wants locked immediately on return
          setIsLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [tokens, isLocked]);

  // Save tokens to localStorage whenever they change
  useEffect(() => {
    if (tokens.length > 0) {
      localStorage.setItem('access-tokens', JSON.stringify(tokens));
    }
  }, [tokens]);

  const handleOnboardingComplete = (selectedCountry: string, selectedLanguage: string) => {
    localStorage.setItem('access-country', selectedCountry);
    localStorage.setItem('access-language', selectedLanguage);
    setCountry(selectedCountry);
    setLanguage(selectedLanguage);
    setOnboardingComplete(true);
  };

  const addToken = (token: Token) => {
    setIsLoading(true);
    setTokens([...tokens, token]);

    setTimeout(() => {
      setIsLoading(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        if (!biometricEnabled) {
          setScreen({
            type: 'biometric',
            onSuccess: () => {
              setBiometricEnabled(true);
              setIsLocked(false);
              setScreen({ type: 'list' });
            }
          });
        } else {
          setScreen({ type: 'list' });
        }
      }, 1500);
    }, 800);
  };

  const deleteToken = (id: string) => {
    setIsLoading(true);
    const updated = tokens.filter(t => t.id !== id);
    setTokens(updated);

    setTimeout(() => {
      setIsLoading(false);
      if (updated.length === 0) {
        setScreen({ type: 'empty' });
        setBiometricEnabled(false);
        localStorage.removeItem('access-tokens');
      } else {
        setScreen({ type: 'list' });
      }
    }, 600);
  };

  const unlockApp = () => {
    setScreen({
      type: 'biometric',
      onSuccess: () => {
        setIsLocked(false);
        setScreen({ type: 'list' });
      }
    });
  };

  if (onboardingComplete === false && !onboardingSuccess) {
    return (
      <CountryLanguageSelect
        onComplete={() => setOnboardingSuccess(true)}
      />
    );
  }

  if (onboardingComplete === false && onboardingSuccess) {
    return <OnboardingSuccessScreen onContinue={() => setOnboardingComplete(true)} />;
  }

  if (onboardingComplete === null) {
    return <GlobalLoader />;
  }

  if (screen.type === 'biometric') {
    return (
      <BiometricPrompt
        onSuccess={screen.onSuccess}
        onCancel={() => {
          if (tokens.length === 0) {
            setScreen({ type: 'empty' });
          } else {
            setIsLocked(true);
            setScreen({ type: 'list' });
          }
        }}
      />
    );
  }

  if (screen.type === 'detail') {
    if (isLoading) {
      return <GlobalLoader />;
    }
    return (
      <TokenDetail
        token={screen.token}
        onBack={() => setScreen({ type: 'list' })}
        onDelete={() => deleteToken(screen.token.id)}
      />
    );
  }

  if (screen.type === 'add-token') {
    return (
      <>
        {isLoading && <GlobalLoader />}
        <AddTokenFlow
          step={screen.step}
          onAddToken={addToken}
          onBack={() => setScreen(tokens.length > 0 ? { type: 'list' } : { type: 'empty' })}
          onChangeStep={(step) => setScreen({ type: 'add-token', step })}
        />
      </>
    );
  }

  if (screen.type === 'settings') {
    return (
      <Settings
        onBack={() => setScreen(tokens.length > 0 ? { type: 'list' } : { type: 'empty' })}
        country={country}
        language={language}
        onCountryChange={setCountry}
        onLanguageChange={setLanguage}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      />
    );
  }

  if (screen.type === 'empty') {
    return (
      <>
        {isLoading && <GlobalLoader />}
        <EmptyState
          onAddToken={() => setScreen({ type: 'add-token', step: 'method' })}
        />
      </>
    );
  }

  return (
    <>
      {isLoading && <GlobalLoader />}
      {showSuccess && <SuccessAnimation message="Token Activated!" subMessage="Your token is now ready to use" />}
      <TokenList
        tokens={tokens}
        isLocked={isLocked}
        onUnlock={unlockApp}
        onAddToken={() => setScreen({ type: 'add-token', step: 'method' })}
        onSelectToken={(token) => setScreen({ type: 'detail', token })}
        onOpenSettings={() => setScreen({ type: 'settings' })}
        country={country}
        language={language}
        onCountryChange={setCountry}
        onLanguageChange={setLanguage}
      />
    </>
  );
}
