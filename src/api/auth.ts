import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, PublicUser, RegisterInput } from '../../shared/schemas';
import { api, ApiError } from './client';

const ME_KEY = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return (await api<{ user: PublicUser }>('/auth/me')).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useAuthConfig() {
  return useQuery({
    queryKey: ['auth-config'],
    queryFn: () => api<{ registrationOpen: boolean }>('/auth/config'),
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api<{ user: PublicUser }>('/auth/login', { method: 'POST', body: input }),
    onSuccess: ({ user }) => qc.setQueryData(ME_KEY, user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api<{ user: PublicUser }>('/auth/register', { method: 'POST', body: input }),
    onSuccess: ({ user }) => qc.setQueryData(ME_KEY, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });
}
