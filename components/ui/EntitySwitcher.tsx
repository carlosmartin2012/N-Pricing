import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Globe } from 'lucide-react';
import { useEntity } from '../../contexts/EntityContext';

interface EntitySwitcherProps {
  labels: {
    entitySwitcher: string;
    groupScope: string;
    activeEntity: string;
    allEntities: string;
  };
}

export const EntitySwitcher: React.FC<EntitySwitcherProps> = ({ labels }) => {
  const { activeEntity, availableEntities, isGroupScope, switchEntity, setGroupScope } = useEntity();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't render if only one entity
  if (availableEntities.length <= 1 && !isGroupScope) return null;

  const entityColors = ['#F48B4A', '#E04870', '#9B59B6', '#06b6d4', '#10b981', '#f59e0b'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
        aria-label={labels.entitySwitcher}
      >
        {isGroupScope ? (
          <Globe className="h-4 w-4 text-cyan-400" />
        ) : (
          <Building2 className="h-4 w-4" style={{ color: entityColors[0] }} />
        )}
        <span className="hidden font-medium sm:inline">
          {isGroupScope ? labels.allEntities : activeEntity?.shortCode ?? '—'}
        </span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-white/10 bg-[var(--nfq-bg-surface)] p-1 shadow-xl">
          <div className="px-3 py-1.5">
            <span className="nfq-label text-[10px]">{labels.activeEntity}</span>
          </div>

          {availableEntities.length > 1 && (
            <button
              onClick={() => { setGroupScope(true); setIsOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
                isGroupScope ? 'bg-cyan-500/10 text-cyan-400' : ''
              }`}
            >
              <Globe className="h-4 w-4 text-cyan-400" />
              {labels.groupScope}
            </button>
          )}

          {availableEntities.map((entity, i) => (
            <button
              key={entity.id}
              onClick={() => { switchEntity(entity.id); setIsOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
                !isGroupScope && activeEntity?.id === entity.id ? 'bg-white/5' : ''
              }`}
            >
              <div
                className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold"
                style={{ backgroundColor: entityColors[i % entityColors.length] + '22', color: entityColors[i % entityColors.length] }}
              >
                {entity.shortCode.slice(0, 2)}
              </div>
              <span>{entity.name}</span>
              {!isGroupScope && activeEntity?.id === entity.id && (
                <span className="ml-auto text-xs text-emerald-400">●</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
