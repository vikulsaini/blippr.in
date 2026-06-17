import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

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
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const timerRef = useRef(null);
  const [exiting, setExiting] = useState(false);
  const Icon = icons[toast.variant] || icons.info;

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 250);
    }, TOAST_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [onDismiss]);

  function handleDismiss() {
    clearTimeout(timerRef.current);
    setExiting(true);
    setTimeout(onDismiss, 250);
  }

  return (
    <div className={`toast toast-${toast.variant} ${exiting ? 'toast-exit' : ''}`}>
      <span className="toast-icon">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">{toast.message}</span>
      <button onClick={handleDismiss} className="shrink-0 rounded-lg p-1 text-text-faint hover:text-text-secondary transition cursor-pointer" aria-label="Dismiss">
        <X size={14} />
      </button>
      <span className="toast-progress" />
    </div>
  );
}
