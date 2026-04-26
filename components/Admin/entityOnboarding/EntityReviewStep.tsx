import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import type { Group } from '../../../types/entity';
import type { BasicInfo, ConfigState, AssignedUser } from './types';

const ReviewSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
    <p className="mb-3 font-mono text-[10px] tracking-normal text-[color:var(--nfq-text-faint)]">
      {title}
    </p>
    <div className="space-y-2">{children}</div>
  </div>
);

const ReviewRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono = false,
}) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-[11px] text-[color:var(--nfq-text-muted)]">{label}</span>
    <span
      className={`text-right text-[11px] font-semibold text-[color:var(--nfq-text-primary)] ${
        mono ? 'font-mono' : ''
      }`}
    >
      {value}
    </span>
  </div>
);

interface Props {
  basicInfo: BasicInfo;
  config: ConfigState;
  assignedUsers: AssignedUser[];
  group: Pick<Group, 'name' | 'shortCode'> | null;
}

export const EntityReviewStep: React.FC<Props> = ({ basicInfo, config, assignedUsers, group }) => (
  <div className="space-y-5">
    <div className="flex items-center gap-3 rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
      <ClipboardCheck size={20} className="text-amber-400" />
      <div>
        <p className="text-xs font-semibold text-[color:var(--nfq-text-primary)]">Review &amp; Create</p>
        <p className="text-[10px] text-[color:var(--nfq-text-muted)]">
          Verify all details before creating the entity.
        </p>
      </div>
    </div>

    <ReviewSection title="Basic Info">
      <ReviewRow label="Name" value={basicInfo.name} />
      {basicInfo.legalName && <ReviewRow label="Legal Name" value={basicInfo.legalName} />}
      <ReviewRow label="Short Code" value={basicInfo.shortCode} mono />
      <ReviewRow label="Country" value={basicInfo.country} />
      <ReviewRow label="Base Currency" value={basicInfo.baseCurrency} mono />
    </ReviewSection>

    <ReviewSection title="Configuration">
      <ReviewRow
        label="Auto-Approval"
        value={`${Number(config.autoApproval).toLocaleString('es-ES')} €`}
        mono
      />
      <ReviewRow
        label="L1 Threshold"
        value={`${Number(config.l1).toLocaleString('es-ES')} €`}
        mono
      />
      <ReviewRow
        label="L2 Threshold"
        value={`${Number(config.l2).toLocaleString('es-ES')} €`}
        mono
      />
      <ReviewRow label="Timezone" value={config.timezone} />
    </ReviewSection>

    <ReviewSection title="Assigned Users">
      {assignedUsers.length === 0 ? (
        <p className="text-[11px] text-[color:var(--nfq-text-faint)]">No users assigned.</p>
      ) : (
        assignedUsers.map((au) => (
          <ReviewRow
            key={au.userId}
            label={au.userId}
            value={au.role === 'Risk_Manager' ? 'Risk Manager' : au.role}
            mono
          />
        ))
      )}
    </ReviewSection>

    {group && (
      <ReviewSection title="Group">
        <ReviewRow label="Assigned to" value={`${group.name} (${group.shortCode})`} />
      </ReviewSection>
    )}
  </div>
);
