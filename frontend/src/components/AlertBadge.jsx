import React from 'react';

const AlertBadge = ({ message, type }) => {
  const alertStyles = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div
      className={`p-4 rounded-lg ${
        alertStyles[type] || alertStyles.success
      }`}
    >
      {message}
    </div>
  );
};

export default AlertBadge;
