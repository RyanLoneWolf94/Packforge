import { useState } from 'react';
import { cn } from '@/src/lib/utils';

/**
 * LoneWolf brand mark.
 *
 * Renders the logo image from `public/`, falling back to a styled "LW" text
 * lockup if the file isn't present yet — so the app never shows a broken image
 * while the artwork is being added, and upgrades automatically once it is.
 *
 * Expected files (drop into `public/`):
 *   - lonewolf-logo.png        full-colour mark, for light backgrounds
 *   - lonewolf-logo-light.png  white/reversed mark, for dark backgrounds
 */
export function Logo({
  variant = 'color',
  className,
  imgClassName,
}: {
  variant?: 'color' | 'light';
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = variant === 'light' ? '/lonewolf-logo-light.png' : '/lonewolf-logo.png';

  if (failed) {
    // Text fallback matching the previous brand lockup.
    const dark = variant === 'light';
    return (
      <span className={cn('inline-flex items-center gap-2.5', className)}>
        <span
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-sm shrink-0',
            dark ? 'bg-white/10 text-orange' : 'bg-orange text-white',
          )}
        >
          LW
        </span>
        <span className="leading-tight">
          <span
            className={cn(
              'disp block font-extrabold text-sm tracking-wide',
              dark ? 'text-white' : 'text-ink',
            )}
          >
            LoneWolf
          </span>
          <span className={cn('block text-[10px] font-semibold', dark ? 'text-white/50' : 'text-ink-soft')}>
            Your Brand's Digital Pack
          </span>
        </span>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt="LoneWolf Digital"
      onError={() => setFailed(true)}
      className={cn('w-auto object-contain', imgClassName)}
    />
  );
}
