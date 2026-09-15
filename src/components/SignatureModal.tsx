import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

/**
 * Captures a signature for a contract — drawn or typed.
 *
 * The result is handed back to the caller (and persisted on the contract), so
 * a signed agreement carries real evidence of who signed rather than just a
 * status flag.
 */

export interface SignatureResult {
  /** PNG data URL when drawn, or `TEXT:<name>:<font>` when typed. */
  signature: string;
  signerName: string;
}

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: (result: SignatureResult) => void;
  contractTitle: string;
  /** Pre-fills the name field — usually the client's contact. */
  defaultSigner?: string;
}

const FONTS = [
  { id: 'font-serif', label: 'Classic' },
  { id: 'font-sans', label: 'Modern' },
  { id: 'font-mono', label: 'Typed' },
];

/**
 * Renders a stored signature, whichever way it was captured — a drawn PNG data
 * URL or a `TEXT:<name>:<font>` marker.
 */
export function SignaturePreview({
  signature,
  className,
}: {
  signature?: string;
  className?: string;
}) {
  if (!signature) return null;

  if (signature.startsWith('TEXT:')) {
    const [, text, font] = signature.split(':');
    return (
      <span className={cn('text-2xl text-ink leading-none', font || 'font-serif', className)}>
        {text}
      </span>
    );
  }

  return (
    <img
      src={signature}
      alt="Signature"
      className={cn('h-12 w-auto object-contain', className)}
    />
  );
}

export default function SignatureModal({
  isOpen,
  onClose,
  onSign,
  contractTitle,
  defaultSigner = '',
}: SignatureModalProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [tab, setTab] = useState<'draw' | 'type'>('draw');
  const [typed, setTyped] = useState('');
  const [fontFamily, setFontFamily] = useState('font-serif');
  const [name, setName] = useState(defaultSigner);

  // Re-seed the name whenever the modal is reopened for a different contract.
  useEffect(() => {
    if (isOpen) setName(defaultSigner);
  }, [isOpen, defaultSigner]);

  if (!isOpen) return null;

  const handleSave = () => {
    const signerName = name.trim();
    if (!signerName) {
      toast.error('Enter your full name to sign');
      return;
    }

    let signature = '';
    if (tab === 'draw') {
      if (sigCanvas.current?.isEmpty()) {
        toast.error('Draw your signature first');
        return;
      }
      signature = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') ?? '';
    } else {
      if (!typed.trim()) {
        toast.error('Type your signature first');
        return;
      }
      signature = `TEXT:${typed.trim()}:${fontFamily}`;
    }

    onSign({ signature, signerName });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-surface rounded-[14px] shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-start justify-between gap-3 p-5 border-b border-line">
            <div>
              <h2 className="disp text-lg font-extrabold text-ink">Sign Contract</h2>
              <p className="text-[13px] text-ink-soft mt-0.5">{contractTitle}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 text-ink-faint hover:text-ink hover:bg-surface-2 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-5 flex-1 overflow-y-auto">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full legal name"
                className="w-full px-4 py-2.5 bg-surface border border-line rounded-lg text-sm text-ink outline-none transition-shadow focus:border-orange focus:ring-2 focus:ring-orange/20 placeholder:text-ink-faint"
              />
            </div>

            <div className="flex gap-2">
              {(['draw', 'type'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 py-2 text-sm font-bold rounded-lg transition-colors capitalize',
                    tab === t
                      ? 'bg-purple-dim text-purple'
                      : 'text-ink-soft hover:bg-surface-2',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === 'draw' ? (
              <div className="space-y-2">
                <div className="border-2 border-dashed border-line rounded-xl bg-surface-2 relative h-[200px]">
                  <SignatureCanvas
                    ref={sigCanvas}
                    canvasProps={{ className: 'signature-canvas w-full h-full rounded-xl' }}
                  />
                  <button
                    onClick={() => sigCanvas.current?.clear()}
                    className="absolute top-2 right-2 px-3 py-1 bg-surface text-[11px] font-bold text-ink-soft border border-line rounded shadow-sm hover:text-ink"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-[11px] text-ink-faint text-center">
                  Draw your signature inside the box.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Type your signature"
                  className="w-full px-4 py-2.5 bg-surface border border-line rounded-lg text-sm text-ink outline-none transition-shadow focus:border-orange focus:ring-2 focus:ring-orange/20 placeholder:text-ink-faint"
                />
                <div className="grid grid-cols-3 gap-2.5">
                  {FONTS.map((font) => (
                    <button
                      key={font.id}
                      onClick={() => setFontFamily(font.id)}
                      className={cn(
                        'border rounded-lg p-3 text-center transition-colors',
                        font.id,
                        fontFamily === font.id
                          ? 'border-orange ring-1 ring-orange bg-orange-dim'
                          : 'border-line hover:border-ink-faint',
                      )}
                    >
                      <span className="block text-base text-ink truncate">
                        {typed || 'Signature'}
                      </span>
                      <span className="block text-[10px] text-ink-faint mt-1 font-sans">
                        {font.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-ink-soft leading-relaxed">
              By signing you confirm you have read and agree to the terms of this agreement. Your
              name, signature and the date are recorded with the contract.
            </p>
          </div>

          <div className="p-4 border-t border-line bg-surface-2 flex justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-ink-soft hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-bold text-white bg-orange rounded-lg hover:bg-orange-deep transition-colors flex items-center gap-2"
            >
              <Check size={16} />
              Sign &amp; Accept
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
