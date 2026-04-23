import { useQuery } from '@tanstack/react-query';
import { getKycStatus } from '../api/kyc';
import { getAccounts, lookupAccount } from '../api/transactions';
import { queryKeys } from './keys';

const ACCOUNTS_STALE_MS = 45_000;
const KYC_STALE_MS = 2 * 60_000;
const LOOKUP_STALE_MS = 5 * 60_000;

/** Shared cache for GET /customers/{id}/accounts — Home + Transfer use the same key. */
export function useAccountsQuery(customerId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.accounts(customerId ?? ''),
    queryFn: () => getAccounts(customerId!),
    enabled: !!customerId,
    staleTime: ACCOUNTS_STALE_MS,
  });
}

export function useKycStatusQuery(customerId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.kycStatus(customerId ?? ''),
    queryFn: () => getKycStatus(customerId!),
    enabled: !!customerId,
    staleTime: KYC_STALE_MS,
  });
}

/** Beneficiary resolution — cached per 10-digit account number to avoid repeat lookups. */
export function useAccountLookupQuery(accountNumber: string, bankSelected: boolean) {
  const trimmed = accountNumber.trim();
  const enabled = trimmed.length === 10 && bankSelected;
  return useQuery({
    queryKey: queryKeys.accountLookup(trimmed),
    queryFn: () => lookupAccount(trimmed),
    enabled,
    staleTime: LOOKUP_STALE_MS,
    gcTime: 15 * 60_000,
  });
}
