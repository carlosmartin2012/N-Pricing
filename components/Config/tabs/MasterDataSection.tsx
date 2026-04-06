import React from 'react';

interface Props {
  title: string;
  icon: React.ReactNode;
  addLabel: React.ReactNode;
  compactAddButton?: boolean;
  className?: string;
  onAdd: () => void;
  children: React.ReactNode;
}

const MasterDataSection: React.FC<Props> = ({
  title,
  icon,
  addLabel,
  compactAddButton = false,
  className = '',
  onAdd,
  children,
}) => (
  <div className={`rounded-lg border border-slate-800 bg-slate-900 p-4 ${className}`}>
    <div className="mb-4 flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-200">
        {icon}
        {title}
      </h3>
      <button
        onClick={onAdd}
        className={`flex items-center gap-1 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 ${compactAddButton ? 'px-2 py-1 text-[10px]' : 'px-3 py-1 text-xs'}`}
      >
        {addLabel}
      </button>
    </div>
    {children}
  </div>
);

export default MasterDataSection;
