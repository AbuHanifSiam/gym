import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Plan,
  PlanInput,
  PlanSummary,
  PublicUser,
  SettingsUpdate,
} from '../../shared/schemas';
import { api } from './client';

const KEY = ['plans'] as const;

export function usePlans() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api<{ plans: PlanSummary[] }>('/plans')).plans,
  });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    enabled: !!id,
    queryFn: async () => (await api<{ plan: Plan }>(`/plans/${id}`)).plan,
  });
}

function usePlanMutation<V>(fn: (v: V) => Promise<{ plan: Plan }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: ({ plan }) => {
      qc.setQueryData([...KEY, plan.id], plan);
      qc.invalidateQueries({ queryKey: KEY, exact: true });
      // Today's workout depends on the active plan.
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export const useCreatePlan = () =>
  usePlanMutation((input: PlanInput) =>
    api<{ plan: Plan }>('/plans', { method: 'POST', body: input }),
  );

export const useCreateDefaultPlan = () =>
  usePlanMutation(() => api<{ plan: Plan }>('/plans/default', { method: 'POST' }));

export const useSavePlan = () =>
  usePlanMutation(({ id, input }: { id: string; input: PlanInput }) =>
    api<{ plan: Plan }>(`/plans/${id}`, { method: 'PUT', body: input }),
  );

export const useDuplicatePlan = () =>
  usePlanMutation((id: string) =>
    api<{ plan: Plan }>(`/plans/${id}/duplicate`, { method: 'POST' }),
  );

export function useActivatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/plans/${id}/activate`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/plans/${id}`, { method: 'DELETE' }),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: [...KEY, id] });
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['today'] });
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: SettingsUpdate) =>
      api<{ user: PublicUser }>('/settings', { method: 'PUT', body: update }),
    onMutate: (update) => {
      // Optimistic: apply immediately so the UI doesn't wait.
      const prev = qc.getQueryData<PublicUser | null>(['me']);
      if (prev) qc.setQueryData(['me'], { ...prev, settings: { ...prev.settings, ...update } });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['me'], ctx.prev),
    onSuccess: ({ user }) => qc.setQueryData(['me'], user),
  });
}
