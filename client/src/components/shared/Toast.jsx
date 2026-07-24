import { useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';
import '../../styles/animations.css';

const BG = { info: '#1565c0', success: '#2e7d32', warning: '#e65100', error: '#b71c1c' };

function ToastItem({ toast }) {
  const removeToast = useUiStore(s => s.removeToast);

  useEffect(() => {
    const t = setTimeout(() => removeToast(toast.id), 3500);
    return () => clearTimeout(t);
  }, [toast.id]);

  return (
    <div style={{
      background: BG[toast.type] || BG.info,
      color: '#fff',
      padding: '10px 16px',
      borderRadius: 8,
      marginBottom: 8,
      fontSize: '0.88rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
      animation: 'toastIn 0.3s ease both',
      maxWidth: 300,
    }}>
      {toast.msg}
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useUiStore(s => s.toasts);

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
    }}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}
