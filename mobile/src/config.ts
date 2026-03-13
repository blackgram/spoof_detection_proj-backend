/**
 * Backend API configuration (set EXPO_PUBLIC_API_URL in .env.local).
 * - iOS Simulator: http://localhost:8000
 * - Android Emulator: http://10.0.2.2:8000
 * - Physical device: http://YOUR_COMPUTER_IP:8000 (same Wi‑Fi as phone; run backend with --host 0.0.0.0)
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
