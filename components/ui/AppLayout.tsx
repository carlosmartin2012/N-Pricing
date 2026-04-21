import React from 'react';
import { Outlet } from 'react-router';

/**
 * App layout — persistent shell for every inner route.
 *
 * Replaces the ~20 `<div className="relative z-0 flex h-full flex-col">`
 * wrappers scattered across App.tsx. Child routes declare their own content;
 * the layout owns the frame (positioning, flex-col, error isolation).
 *
 * Variants: some views want a flex-col (tables, grids), others want raw
 * h-full (workspace shells). Pass `variant="bare"` for the latter.
 */

interface Props {
  variant?: 'flex-col' | 'bare';
}

const AppLayout: React.FC<Props> = ({ variant = 'flex-col' }) => {
  const className = variant === 'bare'
    ? 'relative z-0 h-full'
    : 'relative z-0 flex h-full flex-col';
  return (
    <div className={className}>
      <Outlet />
    </div>
  );
};

export default AppLayout;
