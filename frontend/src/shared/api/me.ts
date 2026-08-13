import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface Me {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  languageCode: string;
}

/**
 * The signed-in identity, as the backend resolved it from initData.
 *
 * Cached forever and never retried: it cannot change inside a session (the
 * guard derives it from the same initData every request carries), and every
 * caller so far treats it as decoration — a name on a chip — so a failure
 * should degrade to "شما" rather than block a screen.
 */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get<Me>('/me'),
    staleTime: Infinity,
    retry: false,
  });
}

export function meDisplayName(me: Me | undefined): string {
  if (!me) return '';
  return `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim() || me.username || '';
}
