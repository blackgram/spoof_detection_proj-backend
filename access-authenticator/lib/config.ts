export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';

export const ACTIVATE_SECRET =
  process.env.EXPO_PUBLIC_ACTIVATE_SECRET || process.env.EXPO_SECRET_API_KEY || '';
