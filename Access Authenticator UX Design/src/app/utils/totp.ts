// Simple TOTP implementation for demonstration
export function generateTOTP(secret: string, time: number = Date.now()): string {
  const epoch = Math.floor(time / 1000);
  const counter = Math.floor(epoch / 30);

  // Simple hash function for demo (in production, use HMAC-SHA1)
  let hash = 0;
  const input = secret + counter.toString();
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash;
  }

  // Convert to 6-digit code
  const code = Math.abs(hash) % 1000000;
  return code.toString().padStart(6, '0');
}

export function getTimeRemaining(time: number = Date.now()): number {
  const epoch = Math.floor(time / 1000);
  return 30 - (epoch % 30);
}
