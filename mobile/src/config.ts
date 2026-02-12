/**
 * Backend API configuration.
 * - iOS Simulator: localhost works
 * - Android Emulator: use 10.0.2.2
 * - Physical device: use your computer's IP (e.g. 192.168.1.x)
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
