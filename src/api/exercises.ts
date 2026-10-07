import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Exercise, ExerciseInput } from '../../shared/schemas';
import { api } from './client';

const KEY = ['exercises'] as const;

export function useExercises() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api<{ exercises: Exercise[] }>('/exercises')).exercises,
    staleTime: 5 * 60_000,
  });
}

export function useExercise(id: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: [...KEY, id],
    enabled: !!id,
    queryFn: async () => (await api<{ exercise: Exercise }>(`/exercises/${id}`)).exercise,
    // Show the cached list entry instantly while the detail loads.
    initialData: () => qc.getQueryData<Exercise[]>(KEY)?.find((e) => e.id === id),
  });
}

export function useSaveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ExerciseInput }) =>
      api<{ exercise: Exercise }>(id ? `/exercises/${id}` : '/exercises', {
        method: id ? 'PUT' : 'POST',
        body: input,
      }),
    onSuccess: ({ exercise }) => {
      qc.setQueryData([...KEY, exercise.id], exercise);
      qc.invalidateQueries({ queryKey: KEY, exact: true });
    },
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/exercises/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) => {
      qc.setQueryData<Exercise[]>(KEY, (list) => list?.filter((e) => e.id !== id));
      qc.removeQueries({ queryKey: [...KEY, id] });
    },
  });
}

export function useSeedExercises() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ added: number }>('/exercises/seed', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
