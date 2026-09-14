import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * Studio authentication. Wraps the app so `/admin` can gate on a signed-in
 * studio admin. The portal is public and does not use this.
 *
 * "Admin" is not merely "signed in": access to studio data is restricted at the
 * database to an allow-list (the `app_admins` table). `isAdmin` reflects the
 * `is_studio_admin()` check, so a stray public signup is signed in but sees
 * nothing and is shown the not-authorised screen.
 */

interface AuthResult {
  error?: string;
  /** Set on sign-up when the project requires email confirmation before login. */
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  session: Session | null;
  /** True during the initial session check. */
  loading: boolean;
  /** null while unknown/checking, then whether the signed-in user is a studio admin. */
  isAdmin: boolean | null;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithMagicLink: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Re-check admin membership whenever the signed-in identity changes.
  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setIsAdmin(null);
      return;
    }
    setIsAdmin(null);
    supabase.rpc('is_studio_admin').then(({ data, error }) => {
      if (cancelled) return;
      setIsAdmin(error ? false : Boolean(data));
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // If email confirmation is on, there's a user but no session yet.
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/admin' },
    });
    return { error: error?.message };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      isAdmin,
      signInWithPassword,
      signUp,
      signInWithMagicLink,
      signOut,
    }),
    [session, loading, isAdmin, signInWithPassword, signUp, signInWithMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an <AuthProvider>');
  return ctx;
}
