import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Card } from '@/src/components/ui';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { useAuth } from './AuthProvider';
import Login from './Login';

/** Full-screen spinner while auth/admin state settles. */
function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );
}

/**
 * Gate for the studio workspace. Renders the sign-in screen when signed out,
 * a not-authorised notice when signed in without admin access, and the app
 * only for allow-listed studio admins.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, loading, isAdmin, signOut } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-7 text-center">
          <h1 className="disp text-lg font-extrabold text-ink">Backend not configured</h1>
          <p className="text-sm text-ink-soft mt-2">
            Set <code className="text-orange">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-orange">VITE_SUPABASE_PUBLISHABLE_KEY</code> in your environment,
            then reload.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) return <FullScreenSpinner />;
  if (!session) return <Login />;
  // Signed in, but admin membership not yet resolved.
  if (isAdmin === null) return <FullScreenSpinner />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-7 text-center">
          <div className="w-12 h-12 rounded-full bg-red-dim text-red flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={22} />
          </div>
          <h1 className="disp text-lg font-extrabold text-ink">Not authorised</h1>
          <p className="text-sm text-ink-soft mt-2">
            <b>{session.user.email}</b> isn't on the studio access list. Ask an existing admin to add
            you, then sign in again.
          </p>
          <Button variant="secondary" className="mt-5" onClick={signOut}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
