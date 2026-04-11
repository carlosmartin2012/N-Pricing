import type { DataContextType } from '../../contexts/DataContext';
import type { PricingDossierStatus, Transaction } from '../../types';

const replaceDealIdentifier = (value: string | undefined, previousId: string, nextId: string) =>
  value ? value.split(previousId).join(nextId) : value;

export const mapWorkflowStatusToDossierStatus = (status?: Transaction['status']): PricingDossierStatus | null => {
  if (!status) return null;
  if (status === 'Pending_Approval') return 'Pending_Approval';
  if (status === 'Approved') return 'Approved';
  if (status === 'Rejected') return 'Rejected';
  if (status === 'Booked') return 'Booked';
  if (status === 'Draft') return 'Draft';
  return null;
};

export interface RenamedDealReferences {
  nextApprovalTasks: DataContextType['approvalTasks'];
  nextPricingDossiers: DataContextType['pricingDossiers'];
  nextPortfolioSnapshots: DataContextType['portfolioSnapshots'];
}

export const updateReferencedDealId = (
  previousId: string,
  nextId: string,
  data: Pick<DataContextType, 'approvalTasks' | 'pricingDossiers' | 'portfolioSnapshots'>,
): RenamedDealReferences => {
  const nextApprovalTasks = data.approvalTasks.map((task) => {
    if (task.scope !== 'DEAL_PRICING' || task.subject.id !== previousId) return task;

    return {
      ...task,
      title: replaceDealIdentifier(task.title, previousId, nextId) || task.title,
      description: replaceDealIdentifier(task.description, previousId, nextId) || task.description,
      subject: {
        ...task.subject,
        id: nextId,
        label: replaceDealIdentifier(task.subject.label, previousId, nextId) || nextId,
      },
      correlation: {
        ...task.correlation,
        dealId: nextId,
      },
    };
  });

  const nextPricingDossiers = data.pricingDossiers.map((dossier) => {
    if (dossier.dealId !== previousId) return dossier;

    return {
      ...dossier,
      dealId: nextId,
      title: replaceDealIdentifier(dossier.title, previousId, nextId) || dossier.title,
      dealSnapshot: {
        ...dossier.dealSnapshot,
        id: nextId,
      },
      evidence: dossier.evidence.map((evidence) => ({
        ...evidence,
        label: replaceDealIdentifier(evidence.label, previousId, nextId) || evidence.label,
      })),
      correlation: {
        ...dossier.correlation,
        dealId: nextId,
      },
      groundedContext: dossier.groundedContext
        ? {
            ...dossier.groundedContext,
            dealId: nextId,
            subjectRefs: dossier.groundedContext.subjectRefs.map((subject) =>
              subject.type === 'DEAL' && subject.id === previousId
                ? {
                    ...subject,
                    id: nextId,
                    label: replaceDealIdentifier(subject.label, previousId, nextId) || nextId,
                  }
                : subject,
            ),
          }
        : dossier.groundedContext,
      aiResponseTraces: dossier.aiResponseTraces?.map((trace) => ({
        ...trace,
        groundedContext: {
          ...trace.groundedContext,
          dealId: trace.groundedContext.dealId === previousId ? nextId : trace.groundedContext.dealId,
          subjectRefs: trace.groundedContext.subjectRefs.map((subject) =>
            subject.type === 'DEAL' && subject.id === previousId
              ? {
                  ...subject,
                  id: nextId,
                  label: replaceDealIdentifier(subject.label, previousId, nextId) || nextId,
                }
              : subject,
          ),
        },
        sources: trace.sources.map((subject) =>
          subject.type === 'DEAL' && subject.id === previousId
            ? {
                ...subject,
                id: nextId,
                label: replaceDealIdentifier(subject.label, previousId, nextId) || nextId,
              }
            : subject,
        ),
      })),
    };
  });

  const nextPortfolioSnapshots = data.portfolioSnapshots.map((snapshot) => ({
    ...snapshot,
    dealIds: snapshot.dealIds.map((dealId) => (dealId === previousId ? nextId : dealId)),
    results: snapshot.results.map((result) =>
      result.dealId === previousId
        ? {
            ...result,
            dealId: nextId,
          }
        : result,
    ),
  }));

  return {
    nextApprovalTasks,
    nextPricingDossiers,
    nextPortfolioSnapshots,
  };
};
