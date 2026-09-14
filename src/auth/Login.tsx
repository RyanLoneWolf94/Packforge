import { useState } from 'react';
import { Loader2, LogIn, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Field, Input } from '@/src/components/ui';
import { Logo } from '@/src/components/Logo';
import { STUDIO } from '@/src/brand';
import { useAuth } from './AuthProvider';

/**
 * Studio sign-in. Offers a password flow (with first-run sign-up) and a
 * passwordless magic-link flow, so the studio can get in even if password
 * email delivery is fussy. Access to data is still gated to the admin
 * allow-list in the database regardless of how you sign in.
 */
export default function Login() {
  const { signInWithPassword, signUp, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Enter your email and password');
      return;
    }
    setBusy(true);
    const result = isSignUp
      ? await signUp(email.trim(), password)
      : await signInWithPassword(email.trim(), password);
    setBusy(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (isSignUp) {
      if (result.needsConfirmation) {
        toast.success('Account created — check your email to confirm, then sign in.');
        setIsSignUp(false);
      } else {
        toast.success('Welcome to the studio.');
      }
    }
    // On success the auth listener swaps this screen for the workspace.
  };

  const submitMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Enter your email');
      return;
    }
    setBusy(true);
    const result = await signInWithMagicLink(email.trim());
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo variant="color" imgClassName="h-11" />
        </div>

        <Card className="p-7">
          <h1 className="disp text-xl font-extrabold text-ink text-center">Studio Workspace</h1>
          <p className="text-[13px] text-ink-soft text-center mt-1 mb-6">
            Sign in to manage {STUDIO.name}.
          </p>

          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-orange-dim text-orange flex items-center justify-center mx-auto mb-4">
                <Mail size={22} />
              </div>
              <p className="text-sm text-ink font-bold">Check your inbox</p>
              <p className="text-[13px] text-ink-soft mt-1">
                We sent a sign-in link to <b>{email}</b>. Open it on this device to continue.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-5 text-xs font-bold text-orange hover:text-orange-deep"
              >
                Use a different email
              </button>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={submitPassword} className="space-y-4">
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@lonewolfdigitech.com"
                  autoFocus
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Button type="submit" icon={busy ? Loader2 : LogIn} disabled={busy} className="w-full">
                {isSignUp ? 'Create account' : 'Sign in'}
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setIsSignUp((v) => !v)}
                  className="font-bold text-ink-soft hover:text-ink"
                >
                  {isSignUp ? 'Have an account? Sign in' : 'First time? Create account'}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('magic')}
                  className="font-bold text-orange hover:text-orange-deep"
                >
                  Email me a link
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitMagic} className="space-y-4">
              <Field label="Email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@lonewolfdigitech.com"
                  autoFocus
                />
              </Field>
              <Button type="submit" icon={busy ? Loader2 : Mail} disabled={busy} className="w-full">
                Send magic link
              </Button>
              <div className="text-center text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setMode('password')}
                  className="font-bold text-orange hover:text-orange-deep"
                >
                  Use a password instead
                </button>
              </div>
            </form>
          )}
        </Card>

        <p className="text-center text-[11px] text-ink-faint mt-5">
          Client looking for your project? Use the portal link your studio sent you.
        </p>
      </div>
    </div>
  );
}
