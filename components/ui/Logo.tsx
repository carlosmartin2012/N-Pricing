import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="n-gradient" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ef4444" /> {/* Red/Rose */}
        <stop offset="50%" stopColor="#a855f7" /> {/* Purple transition */}
        <stop offset="100%" stopColor="#3b82f6" /> {/* Blue */}
      </linearGradient>
    </defs>
    {/* Abstract Folded N shape */}
    <path 
      d="M20 90 V 10 L 60 60 L 60 10 L 90 10 V 90 L 50 40 L 50 90 Z" 
      fill="url(#n-gradient)" 
      stroke="none"
    />
  </svg>
);
