import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BodyLog, BodyLogInput } from '../../shared/schemas';
import { api } from './client';

const KEY = ['body'] as const;

/** All entries, oldest first. */
export function useBodyLogs() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api<{ logs: BodyLog[] }>('/body')).logs,
  });
}

/** Saves the entry for its date (creates or replaces that day). */
export function useSaveBodyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BodyLogInput) =>
      api<{ log: BodyLog }>('/body', { method: 'POST', body: input }),
    onSuccess: ({ log }) =>
      qc.setQueryData<BodyLog[]>(KEY, (list) =>
        [...(list ?? []).filter((l) => l.date !== log.date), log].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      ),
  });
}

export function useDeleteBodyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/body/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) =>
      qc.setQueryData<BodyLog[]>(KEY, (list) => list?.filter((l) => l.id !== id)),
  });
}
