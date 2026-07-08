/**
 * Removes `aps-environment` from the iOS entitlements plist after other plugins run.
 *
 * Use this when Xcode fails with:
 *   Provisioning profile doesn't include the Push Notifications capability / aps-environment
 * (common with Apple "Personal Team" / free provisioning while `expo-notifications` adds APNS).
 *
 * Trade-off: remote push (Expo push token on iOS) will not work until you either:
 * - remove this plugin and enable Push Notifications for your App ID in Apple Developer, then
 *   use a provisioning profile that includes that capability (paid program / EAS credential sync), or
 * - keep this plugin for local dev-only builds that do not need iOS push.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

function withStripIosPushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
}

module.exports = withStripIosPushEntitlement;
