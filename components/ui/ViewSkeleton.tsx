import React from 'react';

const Bone: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-[var(--nfq-bg-elevated)] ${className}`} />
);

/** Calculator-style skeleton: form panel + receipt panel side by side */
export const CalculatorSkeleton: React.FC = () => (
  <div className="grid gap-4 lg:grid-cols-12">
    <div className="flex flex-col gap-3 lg:col-span-4">
      <Bone className="h-10 w-full rounded-xl" />
      <Bone className="h-10 w-full rounded-xl" />
      <Bone className="h-10 w-3/4 rounded-xl" />
      <Bone className="h-10 w-full rounded-xl" />
      <Bone className="h-10 w-5/6 rounded-xl" />
      <Bone className="h-10 w-full rounded-xl" />
    </div>
    <div className="flex flex-col gap-3 lg:col-span-8">
      <Bone className="h-48 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        <Bone className="h-20 rounded-xl" />
        <Bone className="h-20 rounded-xl" />
        <Bone className="h-20 rounded-xl" />
      </div>
      <Bone className="h-32 w-full rounded-2xl" />
    </div>
  </div>
);

/** Table-style skeleton: toolbar + rows */
export const TableSkeleton: React.FC = () => (
  <div className="flex flex-col gap-3 rounded-[24px] bg-[var(--nfq-bg-surface)] p-5">
    <div className="flex items-center gap-3">
      <Bone className="h-9 w-64 rounded-lg" />
      <Bone className="h-9 w-32 rounded-lg" />
      <div className="flex-1" />
      <Bone className="h-9 w-20 rounded-lg" />
      <Bone className="h-9 w-20 rounded-lg" />
    </div>
    <Bone className="h-10 w-full rounded-lg" />
    {Array.from({ length: 6 }).map((_, i) => (
      <Bone key={i} className="h-12 w-full rounded-lg" />
    ))}
  </div>
);

/** Dashboard-style skeleton: KPI cards + chart */
export const DashboardSkeleton: React.FC = () => (
  <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Bone key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Bone className="h-64 rounded-2xl" />
      <Bone className="h-64 rounded-2xl" />
    </div>
  </div>
);

/** Config-style skeleton: tab bar + form fields */
export const ConfigSkeleton: React.FC = () => (
  <div className="flex flex-col gap-3 rounded-[24px] bg-[var(--nfq-bg-surface)] p-5">
    <div className="flex gap-2 border-b border-[var(--nfq-border-ghost)] pb-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Bone key={i} className="h-8 w-24 rounded-lg" />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-4 pt-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Bone key={i} className="h-10 rounded-lg" />
      ))}
    </div>
  </div>
);
