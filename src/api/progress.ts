import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type {
  ExerciseProgress,
  ProgressSummary,
  SessionPage,
  WorkoutSession,
} from '../../shared/schemas';
import { api } from './client';

export function useProgressSummary(month: string | null) {
  return useQuery({
    queryKey: ['progress', 'summary', month],
    queryFn: () =>
      api<ProgressSummary>(month ? `/progress/summary?month=${month}` : '/progress/summary'),
  });
}

export function useSessionHistory() {
  return useInfiniteQuery({
    queryKey: ['sessions', 'history'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<SessionPage>(
        pageParam ? `/sessions?before=${encodeURIComponent(pageParam)}` : '/sessions',
      ),
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useSessionDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['sessions', 'detail', id],
    enabled: !!id,
    queryFn: async () => (await api<{ session: WorkoutSession }>(`/sessions/${id}`)).session,
  });
}

export function useExerciseProgress(id: string | undefined) {
  return useQuery({
    queryKey: ['progress', 'exercise', id],
    enabled: !!id,
    queryFn: () => api<ExerciseProgress>(`/progress/exercise/${id}`),
  });
}
