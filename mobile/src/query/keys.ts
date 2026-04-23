/** Central query keys for TanStack Query — use for invalidation and shared cache. */
export const queryKeys = {
  accounts: (customerId: string) => ['accounts', customerId] as const,
  kycStatus: (customerId: string) => ['kycStatus', customerId] as const,
  accountLookup: (accountNumber: string) => ['accountLookup', accountNumber] as const,
};
