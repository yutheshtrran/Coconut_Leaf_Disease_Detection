import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';

const Toast = ({ type = 'info', message = '', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onClose && onClose(), duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  const styles = {
    success: {
      bg: 'bg-green-600',
      Icon: CheckCircle,
      label: 'Success',
    },
    error: {
      bg: 'bg-red-600',
      Icon: AlertTriangle,
      label: 'Error',
    },
    info: {
      bg: 'bg-yellow-500',
      Icon: Info,
      label: 'Notice',
    },
  };
  const { bg, Icon } = styles[type] || styles.info;

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 ${bg} text-white rounded-xl shadow-2xl flex items-center gap-3 transition-opacity duration-300`}> 
      <Icon size={20} className="shrink-0" />
      <p className="font-semibold">{message}</p>
      <button onClick={onClose} aria-label="Close" className="ml-2 text-white/80 hover:text-white">×</button>
    </div>
  );
};

export default Toast;