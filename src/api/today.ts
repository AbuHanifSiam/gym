import { useQuery } from '@tanstack/react-query';
import type { LastPerformance, TodayResponse } from '../../shared/schemas';
import { api, ApiError } from './client';

const cacheKey = (dayIndex: number | null) => `gt.today.${dayIndex ?? 'now'}`;

/**
 * Today's plan day + last-session numbers. The last good response is kept on the phone so
 * the workout still opens with a bad gym connection.
 */
export function useToday(dayIndex: number | null) {
  return useQuery({
    queryKey: ['today', dayIndex],
    queryFn: async () => {
      try {
        const data = await api<TodayResponse>(
          dayIndex == null ? '/today' : `/today?dayIndex=${dayIndex}`,
        );
        try {
          localStorage.setItem(cacheKey(dayIndex), JSON.stringify(data));
        } catch {
          // ignore
        }
        return { data, offline: false };
      } catch (err) {
        if (err instanceof ApiError && err.status === 0) {
          try {
            const cached = localStorage.getItem(cacheKey(dayIndex));
            if (cached) return { data: JSON.parse(cached) as TodayResponse, offline: true };
          } catch {
            // ignore
          }
        }
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

/** "Last time" numbers for exercises that weren't in the plan for this day (swapped or added). */
export function useLastPerformance(ids: string[], excludeSessionId: string | undefined) {
  const sorted = [...ids].sort();
  return useQuery({
    queryKey: ['last-performance', sorted, excludeSessionId],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const q = new URLSearchParams({ ids: sorted.join(',') });
      if (excludeSessionId) q.set('exclude', excludeSessionId);
      return (await api<{ last: Record<string, LastPerformance> }>(`/last-performance?${q}`)).last;
    },
    staleTime: 5 * 60_000,
  });
}
