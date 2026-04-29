import { Check } from 'lucide-react';

type SuccessAnimationProps = {
  message: string;
  subMessage?: string;
};

export function SuccessAnimation({ message, subMessage }: SuccessAnimationProps) {
  return (
    <div className="fixed inset-0 bg-background/95 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-4 animate-bounce">
          <Check className="w-12 h-12 text-green-600" strokeWidth={3} />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">{message}</h2>
        {subMessage && <p className="text-sm text-muted-foreground">{subMessage}</p>}
      </div>
    </div>
  );
}
