import React from 'react';

export const Panel: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({ children, className = '', title }) => (
  <div className={`bg-slate-900 border border-slate-700/60 shadow-lg flex flex-col ${className}`}>
    {title && (
      <div className="px-4 py-2 border-b border-slate-700/60 bg-slate-800/30 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{title}</h3>
        <div className="h-1 w-1 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
      </div>
    )}
    <div className="flex-1 overflow-auto">
      {children}
    </div>
  </div>
);

export const InputGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col space-y-1 mb-4">
    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono placeholder-slate-700 ${props.className}`}
  />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select
    {...props}
    className={`bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono appearance-none ${props.className}`}
  >
    {props.children}
  </select>
);

export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' }> = ({ children, variant = 'default' }) => {
  const colors = {
    default: 'bg-slate-800 text-slate-300 border-slate-600',
    success: 'bg-emerald-950/50 text-emerald-400 border-emerald-800',
    warning: 'bg-amber-950/50 text-amber-400 border-amber-800',
    danger: 'bg-red-950/50 text-red-400 border-red-800',
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono border rounded-sm ${colors[variant]}`}>
      {children}
    </span>
  );
};
