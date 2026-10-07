import { useQuery } from '@tanstack/react-query';
import type { TodayResponse } from '../../shared/schemas';
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
