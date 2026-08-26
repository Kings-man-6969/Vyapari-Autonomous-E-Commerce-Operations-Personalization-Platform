import React from 'react';
import { useContext } from 'react';
import { ToastContext } from '../hooks/useToast';

// Re-export for files that import from this path
export { useToast } from '../hooks/useToast';

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export default function Toast() {
  const { toasts, removeToast } = useContext(ToastContext);

  if (!toasts.length) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => removeToast(t.id)}
          style={{ cursor: 'pointer' }}
        >
          <span style={{ fontWeight: 700, fontSize: 15 }}>{icons[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
