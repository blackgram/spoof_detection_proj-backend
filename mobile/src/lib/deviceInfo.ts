/**
 * Device info for audit (e.g. device name sent with verify/transaction-verify).
 * Uses expo-device: modelName is the human-friendly model (e.g. "iPhone 15 Pro Max"), deviceName may be user-set (e.g. "John's iPhone").
 */

import * as Device from 'expo-device';

/**
 * Returns a string suitable for audit: model name (e.g. "iPhone 17 Pro Max") or device name, or "Unknown" if unavailable.
 * Prefers modelName for consistency; falls back to deviceName then "Unknown".
 */
export function getDeviceName(): string {
  try {
    const model = Device.modelName ?? Device.deviceName;
    if (model && typeof model === 'string' && model.trim()) {
      return model.trim();
    }
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}
