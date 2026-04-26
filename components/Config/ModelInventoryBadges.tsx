import React from 'react';
import type {
  ModelCategory,
  ModelStatus,
} from '../../utils/pricing/modelInventory';
import {
  CATEGORY_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './modelInventoryConfig';

export function TrafficLightDot({
  light,
}: {
  light: 'GREEN' | 'AMBER' | 'RED';
}) {
  const color =
    light === 'GREEN'
      ? 'bg-emerald-400'
      : light === 'AMBER'
        ? 'bg-amber-400'
        : 'bg-red-400';
  return (
    <div
      className={`inline-block h-2 w-2 rounded-full ${color}`}
      aria-label={light}
    />
  );
}

export function CategoryBadge({ category }: { category: ModelCategory }) {
  const config = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] tracking-normal ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: ModelStatus }) {
  const config = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] tracking-normal ${config.bg} ${config.text}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
