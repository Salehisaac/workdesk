import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PickedItem } from '../../bridge/types';
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
  UpdateLedgerInput,
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
 * Renaming a book — its creator's alone (403 otherwise). Both queries are
 * invalidated because the name is on the list row as well as the book.
 */
export function useUpdateLedger(ledgerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLedgerInput) => apiClient.patch<LedgerDetail>(`/ledgers/${ledgerId}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
      queryClient.invalidateQueries({ queryKey: ledgerKeys.detail(ledgerId) });
    },
  });
}

/**
 * Adding people to a book — its creator's alone. Like a session's, this messages
 * each of them a deep link, because nothing else would ever tell them the book
 * exists.
 */
export function useAddLedgerMembers(ledgerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (members: PickedItem[]) =>
      apiClient.post<LedgerDetail>(`/ledgers/${ledgerId}/members`, { members }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
      queryClient.invalidateQueries({ queryKey: ledgerKeys.detail(ledgerId) });
    },
  });
}

/**
 * Deleting a book — its creator's alone, and it takes every line anyone recorded
 * in it, plus its tags and sources. Callers warn first; there is no undo.
 *
 * The book's own cached detail is dropped rather than refetched (it would only
 * 404 behind a screen being left), while the list is invalidated so the row goes.
 */
export function useDeleteLedger(ledgerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete<void>(`/ledgers/${ledgerId}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ledgerKeys.detail(ledgerId) });
      queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
    },
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
