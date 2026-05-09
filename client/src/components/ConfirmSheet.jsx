import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'neutral',
  onConfirm,
  onCancel
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <button className="fixed inset-0 cursor-default bg-black/40 backdrop-blur-[2px]" onClick={onCancel} aria-label="Close dialog" />
      <motion.div
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="surface relative mx-auto max-w-md rounded-t-[26px] p-4 shadow-glow"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            {description && <p className="mt-1 text-sm leading-6 text-white/55">{description}</p>}
          </div>
          <button onClick={onCancel} className="btn-icon h-8 w-8 shrink-0" aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="btn-secondary rounded-2xl py-3 text-sm font-semibold">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-2xl py-3 text-sm font-semibold ${tone === 'danger' ? 'bg-coral text-ink' : 'btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
