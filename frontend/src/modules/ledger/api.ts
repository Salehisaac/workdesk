import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, getCollection } from '../../shared/api/client';
import type {
  CreateLedgerInput,
  CreateLedgerSourceInput,
  CreateLedgerTagInput,
  CreateTransactionInput,
  Ledger,
  LedgerDetail,
  LedgerSource,
  LedgerTag,
  LedgerTransaction,
} from './types';

const ledgerKeys = {
  all: ['ledgers'] as const,
  detail: (id: string) => ['ledgers', id] as const,
};

export function useLedgers() {
  return useQuery({
    queryKey: ledgerKeys.all,
    queryFn: () => getCollection<Ledger>('/ledgers'),
    retry: false,
  });
}

/**
 * The whole book: its people, its two pools, and every line in it.
 *
 * Everything the module renders comes out of this one query — the three tabs,
 * the five report periods, the filter — because they are all cuts of the same
 * rows (see ./report.ts). That is why nothing here takes a date range.
 */
export function useLedger(ledgerId: string | undefined) {
  return useQuery({
    queryKey: ledgerKeys.detail(ledgerId ?? ''),
    queryFn: () => apiClient.get<LedgerDetail>(`/ledgers/${ledgerId}`),
    enabled: !!ledgerId,
  });
}

export function useCreateLedger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLedgerInput) => apiClient.post<LedgerDetail>('/ledgers', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}

/**
 * Writing a line invalidates both the book and the list: the list row carries
 * this ledger's balance, so a transaction recorded here has to move the figure
 * on the screen the user came from too.
 */
export function useCreateTransaction(ledgerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      apiClient.post<LedgerTransaction>(`/ledgers/${ledgerId}/transactions`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ledgerKeys.detail(ledgerId) });
      queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
    },
  });
}

/**
 * The module's one destructive call, and the only editing it offers: correcting
 * a mistyped amount is deleting the line and writing it again. Same
 * invalidations as creating one, for the same reason — a balance changed.
 */
export function useDeleteTransaction(ledgerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) =>
      apiClient.delete<void>(`/ledgers/${ledgerId}/transactions/${transactionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ledgerKeys.detail(ledgerId) });
      queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
    },
  });
}

/**
 * Tags are ledger-scoped, so creating one adds it to the pool every transaction
 * in this book can draw from — which is why the sheet writes through here
 * immediately instead of holding the name in the transaction's payload. Only
 * the detail query is invalidated: the pool travels inside it.
 */
export function useCreateLedgerTag(ledgerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLedgerTagInput) => apiClient.post<LedgerTag>(`/ledgers/${ledgerId}/tags`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.detail(ledgerId) }),
  });
}

/** «منبع مالی» — same pool mechanics as tags, one per book. */
export function useCreateLedgerSource(ledgerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLedgerSourceInput) => apiClient.post<LedgerSource>(`/ledgers/${ledgerId}/sources`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ledgerKeys.detail(ledgerId) }),
  });
}
