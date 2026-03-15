import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      console.log('[Auth] Initial session:', s ? 'found' : 'none');
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      console.log('[Auth] State changed:', _event);
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('[Auth] Login successful');
      setSession(data.session);
      setUser(data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      console.log('[Auth] Logout successful');
      setSession(null);
      setUser(null);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
  });

  const login = useCallback(
    (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    [loginMutation]
  );

  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation]);

  const changePassword = useCallback(
    (newPassword: string) => changePasswordMutation.mutateAsync(newPassword),
    [changePasswordMutation]
  );

  return useMemo(() => ({
    session,
    user,
    isLoading,
    isAuthenticated: !!session,
    login,
    logout,
    changePassword,
    loginPending: loginMutation.isPending,
    logoutPending: logoutMutation.isPending,
    changePasswordPending: changePasswordMutation.isPending,
    loginError: loginMutation.error,
    changePasswordError: changePasswordMutation.error,
    changePasswordSuccess: changePasswordMutation.isSuccess,
    resetChangePassword: changePasswordMutation.reset,
  }), [
    session, user, isLoading, login, logout, changePassword,
    loginMutation.isPending, logoutMutation.isPending, changePasswordMutation.isPending,
    loginMutation.error, changePasswordMutation.error, changePasswordMutation.isSuccess,
    changePasswordMutation.reset,
  ]);
});
