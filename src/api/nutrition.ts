import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calorieAdvice, type FoodSeed } from '../../shared/nutrition';
import type {
  CustomFoodInput,
  FoodLogEntry,
  FoodLogInput,
  ProfileUpdate,
  PublicUser,
} from '../../shared/schemas';
import { localDay } from '../../shared/time';
import { useMe } from './auth';
import { useBodyLogs } from './body';
import { api } from './client';

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: ProfileUpdate) =>
      api<{ user: PublicUser }>('/profile', { method: 'PUT', body: update }),
    onSuccess: ({ user }) => qc.setQueryData(['me'], user),
  });
}

/**
 * BMI and daily calorie target from the profile and the latest logged weight.
 * `missing` lists what the user still has to enter.
 */
export function useCalorieAdvice() {
  const { data: me } = useMe();
  const { data: logs, isPending } = useBodyLogs();
  const today = localDay(me?.settings.timezone ?? 'Asia/Dhaka').date;
  const p = me?.profile;
  const weight = logs?.filter((l) => l.weight != null).at(-1)?.weight ?? null;
  const missing = [
    !p?.heightCm && 'height',
    !p?.birthDate && 'birth date',
    !p?.sex && 'sex',
    weight == null && 'weight',
  ].filter((m): m is string => !!m);
  const advice =
    p && p.heightCm && p.birthDate && p.sex && weight != null
      ? calorieAdvice(
          { sex: p.sex, heightCm: p.heightCm, birthDate: p.birthDate, activity: p.activity },
          weight,
          today,
          p.goal,
        )
      : null;
  return { advice, missing, weight, today, isPending: !me || isPending };
}

export function useFoodSearch(q: string) {
  return useQuery({
    queryKey: ['foods', q],
    queryFn: async () =>
      (await api<{ foods: FoodSeed[] }>(`/foods?q=${encodeURIComponent(q)}`)).foods,
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useAddCustomFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomFoodInput) =>
      api<{ food: FoodSeed }>('/foods', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['foods'] }),
  });
}

const logKey = (date: string) => ['food-log', date] as const;

export function useFoodLog(date: string) {
  return useQuery({
    queryKey: logKey(date),
    queryFn: async () => (await api<{ entries: FoodLogEntry[] }>(`/food-log?date=${date}`)).entries,
  });
}

export function useAddFoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodLogInput) =>
      api<{ entry: FoodLogEntry }>('/food-log', { method: 'POST', body: input }),
    onSuccess: ({ entry }) =>
      qc.setQueryData<FoodLogEntry[]>(logKey(entry.date), (list) => [...(list ?? []), entry]),
  });
}

export function useDeleteFoodLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/food-log/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) =>
      qc.setQueryData<FoodLogEntry[]>(logKey(date), (list) => list?.filter((e) => e.id !== id)),
  });
}
