import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TOAST_DURATION = 3000;
let toastId = 0;
let addToastExternal = null;

/** Call from anywhere to show a toast. */
export function showToast(message, variant = 'info') {
  if (addToastExternal) addToastExternal({ id: ++toastId, message, variant });
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
};

export default function ToastProvider() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    addToastExternal = (toast) => {
      setToasts((current) => [...current.slice(-4), toast]);
    };
    return () => { addToastExternal = null; };
  }, []);

  function dismiss(id) {
    setToasts((current) => current.filter((t) => t.id !== id));
  }

  return (
    <div className="toast-container" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const timerRef = useRef(null);
  const Icon = icons[toast.variant] || icons.info;

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, TOAST_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      className={`toast toast-${toast.variant}`}
    >
      <span className="toast-icon">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="shrink-0 rounded-lg p-1 text-text-faint hover:text-text-secondary transition cursor-pointer" aria-label="Dismiss">
        <X size={14} />
      </button>
      <span className="toast-progress" />
    </motion.div>
  );
}

