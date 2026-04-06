import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <img
    src="/assets/logo_final.png"
    alt="Logo"
    className={`${className} object-contain`}
    onError={(e) => (e.currentTarget.style.display = 'none')}
  />
);
