import React from 'react';
import { TooltipTrigger } from './Tooltip';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  eyebrow?: string;
  tone?: 'surface' | 'elevated';
}

export const Panel: React.FC<PanelProps> = ({
  children,
  className = '',
  title,
  actions,
  icon,
  eyebrow,
  tone = 'surface',
}) => (
  <section className={`nfq-panel nfq-panel--${tone} flex h-full min-h-0 flex-col ${className}`}>
    {(title || actions || eyebrow) && (
      <div className="nfq-panel-header shrink-0">
        <div className="min-w-0">
          {eyebrow && <div className="nfq-eyebrow">{eyebrow}</div>}
          {title && (
            <h3 className="mt-3 flex items-center gap-3 text-lg font-semibold tracking-[var(--nfq-tracking-snug)] text-[color:var(--nfq-text-primary)]">
              {icon}
              <span className="truncate">{title}</span>
            </h3>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          {!actions && <div className="nfq-status-orb" />}
        </div>
      </div>
    )}
    <div className="nfq-panel-body flex-1 min-h-0 overflow-auto">{children}</div>
  </section>
);

export const InputGroup: React.FC<{ label: string; children: React.ReactNode; hint?: string; tooltip?: string }> = ({
  label,
  children,
  hint,
  tooltip,
}) => (
  <label className="mb-5 flex flex-col gap-2.5">
    <div className="flex items-baseline justify-between gap-4">
      <span className="nfq-label flex items-center">
        {label}
        {tooltip && <TooltipTrigger content={tooltip} size={12} />}
      </span>
      {hint && <span className="text-[11px] text-[color:var(--nfq-text-faint)]">{hint}</span>}
    </div>
    {children}
  </label>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...props} className={`nfq-input-field ${className}`.trim()} />
);

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', ...props }) => (
  <select {...props} className={`nfq-select-field ${className}`.trim()}>
    {props.children}
  </select>
);

export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'secondary' | 'info' | 'muted';
  className?: string;
}> = ({ children, variant = 'default', className = '' }) => {
  const variantMap: Record<string, string> = {
    default: 'nfq-badge--default',
    success: 'nfq-badge--success',
    warning: 'nfq-badge--warning',
    danger: 'nfq-badge--danger',
    outline: 'nfq-badge--outline',
    secondary: 'nfq-badge--info',
    info: 'nfq-badge--info',
    muted: 'nfq-badge--muted',
  };

  return (
    <span
      className={`nfq-badge ${variantMap[variant] || variantMap.default} ${className}`.trim()}
    >
      {children}
    </span>
  );
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
  }
> = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const sizes = {
    sm: 'px-3 text-xs',
    md: 'px-4 text-[14px]',
    lg: 'px-5 text-[14px]',
  };

  return (
    <button {...props} className={`nfq-button nfq-button-${variant} ${sizes[size]} ${className}`.trim()}>
      {children}
    </button>
  );
};
