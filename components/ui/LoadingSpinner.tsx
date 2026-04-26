import React from 'react';

const LoadingSpinner: React.FC<{ label?: string }> = ({ label = 'Loading module...' }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4">
    <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
    <span className="text-[10px] font-mono tracking-normal text-slate-500">{label}</span>
  </div>
);

export default LoadingSpinner;
