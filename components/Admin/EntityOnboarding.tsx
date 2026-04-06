import React, { useState } from 'react';
import {
  Building2,
  Settings,
  Users,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { InputGroup, TextInput, SelectInput } from '../ui/LayoutComponents';
import { useUI } from '../../contexts/UIContext';
import { useEntity } from '../../contexts/EntityContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import * as entitiesApi from '../../api/entities';
import { createLogger } from '../../utils/logger';
import type { EntityUser } from '../../types/entity';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface BasicInfo {
  name: string;
  legalName: string;
  shortCode: string;
  country: string;
  baseCurrency: string;
}

interface ConfigState {
  autoApproval: string;
  l1: string;
  l2: string;
  timezone: string;
}

interface AssignedUser {
  userId: string; // stores user.email per upsertEntityUser API
  role: EntityUser['role'];
  isPrimary: boolean;
}

const COUNTRY_OPTIONS = [
  { value: 'ES', label: 'Spain (ES)' },
  { value: 'PT', label: 'Portugal (PT)' },
  { value: 'UK', label: 'United Kingdom (UK)' },
  { value: 'DE', label: 'Germany (DE)' },
  { value: 'FR', label: 'France (FR)' },
  { value: 'IT', label: 'Italy (IT)' },
  { value: 'US', label: 'United States (US)' },
];

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET/CEST)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (WET/WEST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST)' },
  { value: 'UTC', label: 'UTC' },
];

const ROLE_OPTIONS: EntityUser['role'][] = ['Admin', 'Trader', 'Risk_Manager', 'Auditor'];

const STEP_KEYS = ['basicInfo', 'configuration', 'assignUsers', 'reviewCreate'] as const;
type StepKey = (typeof STEP_KEYS)[number];

const STEP_ICONS = [Building2, Settings, Users, ClipboardCheck];

const log = createLogger('EntityOnboarding');

const INITIAL_BASIC: BasicInfo = {
  name: '',
  legalName: '',
  shortCode: '',
  country: 'ES',
  baseCurrency: 'EUR',
};

const INITIAL_CONFIG: ConfigState = {
  autoApproval: '500000',
  l1: '2000000',
  l2: '10000000',
  timezone: 'Europe/Madrid',
};

// ── Main component ─────────────────────────────────────────────────────────────

const EntityOnboarding: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useUI();
  const { group, loadUserEntities } = useEntity();
  const { currentUser } = useAuth();
  const { users } = useData();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [basicInfo, setBasicInfo] = useState<BasicInfo>(INITIAL_BASIC);
  const [config, setConfig] = useState<ConfigState>(INITIAL_CONFIG);
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateStep1 = (): string | null => {
    if (!basicInfo.name.trim()) return 'Entity name is required.';
    if (!basicInfo.shortCode.trim()) return 'Short code is required.';
    if (basicInfo.shortCode.length > 6) return 'Short code must be 6 characters or fewer.';
    if (!/^[A-Z0-9]+$/.test(basicInfo.shortCode))
      return 'Short code must be uppercase alphanumeric (A–Z, 0–9).';
    return null;
  };

  const validateStep2 = (): string | null => {
    const auto = Number(config.autoApproval);
    const l1 = Number(config.l1);
    const l2 = Number(config.l2);
    if (isNaN(auto) || isNaN(l1) || isNaN(l2)) return 'Approval thresholds must be valid numbers.';
    if (auto <= 0 || l1 <= 0 || l2 <= 0) return 'All approval thresholds must be positive.';
    if (auto >= l1) return 'Auto-approval threshold must be less than L1.';
    if (l1 >= l2) return 'L1 threshold must be less than L2.';
    return null;
  };

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleNext = () => {
    setValidationError(null);
    if (currentStep === 1) {
      const err = validateStep1();
      if (err) { setValidationError(err); return; }
    }
    if (currentStep === 2) {
      const err = validateStep2();
      if (err) { setValidationError(err); return; }
    }
    setCurrentStep((s) => Math.min(4, s + 1));
  };

  const handlePrevious = () => {
    setValidationError(null);
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  // ── Field helpers ──────────────────────────────────────────────────────────

  const handleShortCodeChange = (value: string) => {
    setBasicInfo((prev) => ({ ...prev, shortCode: value.toUpperCase().slice(0, 6) }));
  };

  const toggleUserAssignment = (userEmail: string) => {
    setAssignedUsers((prev) => {
      const exists = prev.some((u) => u.userId === userEmail);
      if (exists) return prev.filter((u) => u.userId !== userEmail);
      return [...prev, { userId: userEmail, role: 'Trader', isPrimary: false }];
    });
  };

  const updateUserRole = (userEmail: string, role: EntityUser['role']) => {
    setAssignedUsers((prev) =>
      prev.map((u) => (u.userId === userEmail ? { ...u, role } : u)),
    );
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const entity = await entitiesApi.upsertEntity({
        groupId: group?.id ?? '',
        name: basicInfo.name.trim(),
        legalName: basicInfo.legalName.trim() || basicInfo.name.trim(),
        shortCode: basicInfo.shortCode,
        country: basicInfo.country,
        baseCurrency: basicInfo.baseCurrency,
        timezone: config.timezone,
        approvalMatrix: {
          autoApprovalThreshold: Number(config.autoApproval),
          l1Threshold: Number(config.l1),
          l2Threshold: Number(config.l2),
        },
        isActive: true,
      });

      if (!entity) {
        throw new Error('Entity creation returned no result. Check Supabase configuration.');
      }

      for (const au of assignedUsers) {
        await entitiesApi.upsertEntityUser(entity.id, au.userId, au.role, au.isPrimary);
      }

      if (currentUser?.email) {
        await loadUserEntities(currentUser.email);
      }

      log.info(`Entity created: ${entity.name} (${entity.shortCode})`);
      setSubmitSuccess(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error during entity creation.';
      log.error('Entity creation failed', undefined, err instanceof Error ? err : undefined);
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reset & close ──────────────────────────────────────────────────────────

  const handleClose = () => {
    setCurrentStep(1);
    setBasicInfo(INITIAL_BASIC);
    setConfig(INITIAL_CONFIG);
    setAssignedUsers([]);
    setValidationError(null);
    setSubmitError(null);
    setSubmitSuccess(false);
    onClose();
  };

  // ── Footer ─────────────────────────────────────────────────────────────────

  const footer = submitSuccess ? (
    <div className="flex justify-end">
      <button
        onClick={handleClose}
        className="rounded bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500"
      >
        {t.close}
      </button>
    </div>
  ) : (
    <div className="flex items-center justify-between">
      <button
        onClick={currentStep === 1 ? handleClose : handlePrevious}
        className="px-4 py-2 text-xs text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]"
      >
        {currentStep === 1 ? t.close : t.previous}
      </button>
      <div className="flex gap-2">
        {currentStep < 4 && (
          <button
            onClick={handleNext}
            className="rounded bg-[var(--nfq-accent)] px-5 py-2 text-xs font-bold text-white hover:opacity-90"
          >
            {t.next}
          </button>
        )}
        {currentStep === 4 && (
          <button
            onClick={() => void handleCreate()}
            disabled={isSubmitting}
            className="rounded bg-amber-500 px-5 py-2 text-xs font-bold text-white hover:bg-amber-400 disabled:opacity-50"
          >
            {isSubmitting ? '...' : t.createEntity}
          </button>
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={t.entityOnboarding}
      size="xl"
      footer={footer}
    >
      {/* Step progress */}
      <div className="mb-8">
        <div className="flex items-start gap-0">
          {STEP_ICONS.map((Icon, idx) => {
            const step = idx + 1;
            const isActive = step === currentStep;
            const isDone = step < currentStep;
            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isActive
                          ? 'bg-amber-500 text-white'
                          : 'bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-text-faint)]'
                    }`}
                  >
                    {isDone ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                  </div>
                  <span
                    className={`hidden text-[9px] font-mono uppercase tracking-widest sm:block ${
                      isActive
                        ? 'text-amber-400'
                        : isDone
                          ? 'text-emerald-400'
                          : 'text-[color:var(--nfq-text-faint)]'
                    }`}
                  >
                    {t[STEP_KEYS[idx] as StepKey]}
                  </span>
                </div>
                {idx < STEP_ICONS.length - 1 && (
                  <div
                    className={`mx-1 mt-4 h-px flex-1 transition-colors ${
                      step < currentStep ? 'bg-emerald-600' : 'bg-[var(--nfq-bg-highest)]'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {(validationError ?? submitError) && (
        <div className="mb-5 flex items-start gap-2 rounded border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{validationError ?? submitError}</span>
        </div>
      )}

      {/* Success */}
      {submitSuccess && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 size={48} className="text-emerald-400" />
          <p className="text-base font-semibold text-[color:var(--nfq-text-primary)]">
            {t.entityCreated}
          </p>
          <p className="font-mono text-xs text-[color:var(--nfq-text-muted)]">
            {basicInfo.name} · {basicInfo.shortCode} · {basicInfo.baseCurrency}
          </p>
        </div>
      )}

      {/* ── Step 1: Basic Info ── */}
      {!submitSuccess && currentStep === 1 && (
        <div className="space-y-1">
          <div className="mb-6 flex items-center gap-3 rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
            <Building2 size={20} className="text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-[color:var(--nfq-text-primary)]">
                {t.basicInfo}
              </p>
              <p className="text-[10px] text-[color:var(--nfq-text-muted)]">
                Core identity fields for the new legal entity.
              </p>
            </div>
          </div>

          <InputGroup label="Entity Name *">
            <TextInput
              value={basicInfo.name}
              onChange={(e) => setBasicInfo((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. NFQ Iberia S.A."
              autoFocus
            />
          </InputGroup>

          <InputGroup label="Legal Name" hint="Optional — defaults to Entity Name">
            <TextInput
              value={basicInfo.legalName}
              onChange={(e) => setBasicInfo((prev) => ({ ...prev, legalName: e.target.value }))}
              placeholder="e.g. NFQ Iberia Sociedad Anónima"
            />
          </InputGroup>

          <div className="grid grid-cols-3 gap-4">
            <InputGroup label="Short Code *" hint="Max 6 chars">
              <TextInput
                value={basicInfo.shortCode}
                onChange={(e) => handleShortCodeChange(e.target.value)}
                placeholder="NFQIB"
                maxLength={6}
                className="font-mono uppercase"
              />
            </InputGroup>

            <InputGroup label="Country">
              <SelectInput
                value={basicInfo.country}
                onChange={(e) => setBasicInfo((prev) => ({ ...prev, country: e.target.value }))}
              >
                {COUNTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectInput>
            </InputGroup>

            <InputGroup label="Base Currency">
              <SelectInput
                value={basicInfo.baseCurrency}
                onChange={(e) =>
                  setBasicInfo((prev) => ({ ...prev, baseCurrency: e.target.value }))
                }
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectInput>
            </InputGroup>
          </div>
        </div>
      )}

      {/* ── Step 2: Configuration ── */}
      {!submitSuccess && currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
            <Settings size={20} className="text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-[color:var(--nfq-text-primary)]">
                {t.configuration}
              </p>
              <p className="text-[10px] text-[color:var(--nfq-text-muted)]">
                Approval matrix thresholds and operational timezone.
              </p>
            </div>
          </div>

          <div className="rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[color:var(--nfq-text-faint)]">
              Approval Matrix
            </p>
            <div className="grid grid-cols-3 gap-4">
              <InputGroup label="Auto-Approval (€)" hint="Below → auto">
                <TextInput
                  type="number"
                  value={config.autoApproval}
                  onChange={(e) => setConfig((prev) => ({ ...prev, autoApproval: e.target.value }))}
                  min="0"
                  step="100000"
                  className="font-mono"
                />
              </InputGroup>
              <InputGroup label="L1 Threshold (€)" hint="Requires L1">
                <TextInput
                  type="number"
                  value={config.l1}
                  onChange={(e) => setConfig((prev) => ({ ...prev, l1: e.target.value }))}
                  min="0"
                  step="500000"
                  className="font-mono"
                />
              </InputGroup>
              <InputGroup label="L2 Threshold (€)" hint="Requires L2">
                <TextInput
                  type="number"
                  value={config.l2}
                  onChange={(e) => setConfig((prev) => ({ ...prev, l2: e.target.value }))}
                  min="0"
                  step="1000000"
                  className="font-mono"
                />
              </InputGroup>
            </div>
            <p className="mt-2 text-[10px] text-[color:var(--nfq-text-faint)]">
              Auto ≤ amount → auto-approved · Auto &lt; amount ≤ L1 → L1 review · L1 &lt; amount ≤
              L2 → L2 review
            </p>
          </div>

          <InputGroup label="Timezone">
            <SelectInput
              value={config.timezone}
              onChange={(e) => setConfig((prev) => ({ ...prev, timezone: e.target.value }))}
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SelectInput>
          </InputGroup>
        </div>
      )}

      {/* ── Step 3: Assign Users ── */}
      {!submitSuccess && currentStep === 3 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
            <Users size={20} className="text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-[color:var(--nfq-text-primary)]">
                {t.assignUsers}
              </p>
              <p className="text-[10px] text-[color:var(--nfq-text-muted)]">
                Select users and assign their role within this entity.
              </p>
            </div>
          </div>

          {users.length === 0 && (
            <p className="text-xs text-[color:var(--nfq-text-faint)]">
              No users found in the system.
            </p>
          )}

          <div className="space-y-2">
            {users.map((user) => {
              const assigned = assignedUsers.some((a) => a.userId === user.email);
              const role =
                assignedUsers.find((a) => a.userId === user.email)?.role ?? 'Trader';
              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 rounded border p-3 transition-colors ${
                    assigned
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={() => toggleUserAssignment(user.email)}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[color:var(--nfq-text-primary)]">
                      {user.name}
                    </p>
                    <p className="truncate font-mono text-[10px] text-[color:var(--nfq-text-muted)]">
                      {user.email}
                    </p>
                  </div>
                  {assigned && (
                    <SelectInput
                      value={role}
                      onChange={(e) =>
                        updateUserRole(user.email, e.target.value as EntityUser['role'])
                      }
                      className="w-36 text-xs"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r === 'Risk_Manager' ? 'Risk Manager' : r}
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 4: Review & Create ── */}
      {!submitSuccess && currentStep === 4 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
            <ClipboardCheck size={20} className="text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-[color:var(--nfq-text-primary)]">
                {t.reviewCreate}
              </p>
              <p className="text-[10px] text-[color:var(--nfq-text-muted)]">
                Verify all details before creating the entity.
              </p>
            </div>
          </div>

          <ReviewSection title="Basic Info">
            <ReviewRow label="Name" value={basicInfo.name} />
            {basicInfo.legalName && (
              <ReviewRow label="Legal Name" value={basicInfo.legalName} />
            )}
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
      )}
    </Drawer>
  );
};

// ── Review helpers ─────────────────────────────────────────────────────────────

const ReviewSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
    <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[color:var(--nfq-text-faint)]">
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

export default EntityOnboarding;
