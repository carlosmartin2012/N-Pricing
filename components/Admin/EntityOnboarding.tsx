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
import { useUI } from '../../contexts/UIContext';
import { useEntity } from '../../contexts/EntityContext';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import * as entitiesApi from '../../api/entities';
import { createLogger } from '../../utils/logger';
import type { EntityUser } from '../../types/entity';
import {
  INITIAL_BASIC,
  INITIAL_CONFIG,
  STEP_KEYS,
  validateBasicInfo,
  validateConfiguration,
  type AssignedUser,
  type BasicInfo,
  type ConfigState,
  type StepKey,
} from './entityOnboarding/types';
import { EntityBasicInfoStep } from './entityOnboarding/EntityBasicInfoStep';
import { EntityConfigurationStep } from './entityOnboarding/EntityConfigurationStep';
import { EntityUserAssignmentStep } from './entityOnboarding/EntityUserAssignmentStep';
import { EntityReviewStep } from './entityOnboarding/EntityReviewStep';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const STEP_ICONS = [Building2, Settings, Users, ClipboardCheck];
const LAST_STEP = 4;
const log = createLogger('EntityOnboarding');

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

  // ── Navigation ─────────────────────────────────────────────────────────────
  // Step-specific validators live in ./entityOnboarding/types so they can be
  // unit-tested without rendering the drawer. The orchestrator just gates
  // forward navigation on whichever validator applies to the current step.

  const handleNext = () => {
    setValidationError(null);
    if (currentStep === 1) {
      const err = validateBasicInfo(basicInfo);
      if (err) { setValidationError(err); return; }
    }
    if (currentStep === 2) {
      const err = validateConfiguration(config);
      if (err) { setValidationError(err); return; }
    }
    setCurrentStep((s) => Math.min(LAST_STEP, s + 1));
  };

  const handlePrevious = () => {
    setValidationError(null);
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  // ── User assignment helpers ────────────────────────────────────────────────

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
        await entitiesApi.upsertEntityUser({
          entityId: entity.id,
          userId: au.userId,
          role: au.role,
          isPrimaryEntity: au.isPrimary,
        });
      }

      if (currentUser?.email) {
        await loadUserEntities(currentUser.email);
      }

      log.info(`Entity created: ${entity.name} (${entity.shortCode})`);
      setSubmitSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error during entity creation.';
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
        {currentStep < LAST_STEP && (
          <button
            onClick={handleNext}
            className="rounded bg-[var(--nfq-accent)] px-5 py-2 text-xs font-bold text-white hover:opacity-90"
          >
            {t.next}
          </button>
        )}
        {currentStep === LAST_STEP && (
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

      {!submitSuccess && currentStep === 1 && (
        <EntityBasicInfoStep
          value={basicInfo}
          onChange={(patch) => setBasicInfo((prev) => ({ ...prev, ...patch }))}
        />
      )}

      {!submitSuccess && currentStep === 2 && (
        <EntityConfigurationStep
          value={config}
          onChange={(patch) => setConfig((prev) => ({ ...prev, ...patch }))}
        />
      )}

      {!submitSuccess && currentStep === 3 && (
        <EntityUserAssignmentStep
          users={users}
          assignedUsers={assignedUsers}
          onToggleUser={toggleUserAssignment}
          onChangeRole={updateUserRole}
        />
      )}

      {!submitSuccess && currentStep === LAST_STEP && (
        <EntityReviewStep
          basicInfo={basicInfo}
          config={config}
          assignedUsers={assignedUsers}
          group={group}
        />
      )}
    </Drawer>
  );
};

export default EntityOnboarding;
