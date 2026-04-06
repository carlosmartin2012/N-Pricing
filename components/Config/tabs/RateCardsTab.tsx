import React, { useState } from 'react';
import { Drawer } from '../../ui/Drawer';
import { FtpRateCard } from '../../../types';
import { Plus } from 'lucide-react';
import { useAudit } from '../../../hooks/useAudit';
import { useData } from '../../../contexts/DataContext';
import {
  buildApprovalTaskForMethodologyChange,
  buildConfigChangeOperation,
  buildMethodologyChangeRequest,
  upsertApprovalTask,
  upsertMethodologyChangeRequest,
} from '../../../utils/governanceWorkflows';
import type { ConfigUser } from '../configTypes';
import RateCardCard from './RateCardCard';
import RateCardEditor from './RateCardEditor';
import { createDefaultRateCardDraft, normalizeRateCardDraft } from './rateCardsUtils';
import { supabaseService } from '../../../utils/supabaseService';

interface Props {
  ftpRateCards: FtpRateCard[];
  setFtpRateCards: React.Dispatch<React.SetStateAction<FtpRateCard[]>>;
  user: ConfigUser;
}

const RateCardsTab: React.FC<Props> = ({ ftpRateCards, user }) => {
  const data = useData();
  const logAudit = useAudit(user);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingRateCard, setEditingRateCard] = useState<Partial<FtpRateCard> | null>(null);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingRateCard(null);
  };

  const handleAddRateCard = () => {
    setEditingRateCard(createDefaultRateCardDraft());
    setDrawerOpen(true);
  };

  const handleEditRateCard = (card: FtpRateCard) => {
    setEditingRateCard({ ...card });
    setDrawerOpen(true);
  };

  const handleSaveRateCard = async () => {
    if (editingRateCard && editingRateCard.id) {
      const normalizedCard = normalizeRateCardDraft(editingRateCard);
      const exists = ftpRateCards.find((c) => c.id === normalizedCard.id);
      const request = buildMethodologyChangeRequest({
        title: `${exists ? 'Update' : 'Create'} rate card ${normalizedCard.name}`,
        reason: `${exists ? 'Update' : 'Create'} FTP rate card ${normalizedCard.id} (${normalizedCard.currency})`,
        action: exists ? 'UPDATE' : 'CREATE',
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown User',
        operations: [
          buildConfigChangeOperation('RATE_CARD', exists ? 'UPDATE' : 'CREATE', {
            currentItem: exists,
            proposedItem: normalizedCard,
            summary: `${exists ? 'UPDATE' : 'CREATE'} rate card ${normalizedCard.name} (${normalizedCard.currency})`,
          }),
        ],
      });
      const approvalTask = buildApprovalTaskForMethodologyChange(request, 'Admin');
      const nextRequests = upsertMethodologyChangeRequest(data.methodologyChangeRequests, request);
      const nextTasks = upsertApprovalTask(data.approvalTasks, approvalTask);
      data.setMethodologyChangeRequests(nextRequests);
      data.setApprovalTasks(nextTasks);
      await Promise.all([
        supabaseService.saveMethodologyChangeRequests(nextRequests),
        supabaseService.saveApprovalTasks(nextTasks),
      ]);

      logAudit({
        action: exists ? 'SUBMIT_RATE_CARD_UPDATE' : 'SUBMIT_RATE_CARD_CREATE',
        module: 'SYS_CONFIG',
        description: `${exists ? 'Submitted update' : 'Submitted creation'} for FTP rate card: ${normalizedCard.name} (${normalizedCard.currency})`,
        details: {
          changeRequestId: request.id,
          approvalTaskId: approvalTask.id,
          rateCardId: normalizedCard.id,
        },
      });

      closeDrawer();
    }
  };

  const handleDeleteRateCard = async (id: string) => {
    const card = ftpRateCards.find((c) => c.id === id);
    if (!card) return;
    const request = buildMethodologyChangeRequest({
      title: `Delete rate card ${card.name}`,
      reason: `Delete FTP rate card ${card.id} (${card.currency})`,
      action: 'DELETE',
      userEmail: user?.email || 'unknown',
      userName: user?.name || 'Unknown User',
      operations: [
        buildConfigChangeOperation('RATE_CARD', 'DELETE', {
          currentItem: card,
          summary: `DELETE rate card ${card.name} (${card.currency})`,
        }),
      ],
    });
    const approvalTask = buildApprovalTaskForMethodologyChange(request, 'Admin');
    const nextRequests = upsertMethodologyChangeRequest(data.methodologyChangeRequests, request);
    const nextTasks = upsertApprovalTask(data.approvalTasks, approvalTask);
    data.setMethodologyChangeRequests(nextRequests);
    data.setApprovalTasks(nextTasks);
    await Promise.all([
      supabaseService.saveMethodologyChangeRequests(nextRequests),
      supabaseService.saveApprovalTasks(nextTasks),
    ]);

    logAudit({
      action: 'SUBMIT_RATE_CARD_DELETE',
      module: 'SYS_CONFIG',
      description: `Submitted delete request for FTP rate card: ${card.name}`,
      details: {
        changeRequestId: request.id,
        approvalTaskId: approvalTask.id,
        rateCardId: card.id,
      },
    });
  };

  const pendingRequests = data.methodologyChangeRequests.filter(
    (request) => request.target === 'RATE_CARD' && ['Pending_Review', 'Approved'].includes(request.status)
  ).length;

  return (
    <>
      {pendingRequests > 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
          {pendingRequests} rate card request{pendingRequests === 1 ? '' : 's'} waiting in governance.
        </div>
      )}

      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <div className="text-[10px] text-slate-500">
          Manage FTP components, liquidity add-ons, and commercial pricing grids through controlled change requests.
        </div>
        <button
          onClick={handleAddRateCard}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-900/30 text-purple-400 rounded border border-purple-800 text-xs hover:bg-purple-900/50 font-medium"
        >
          <Plus size={12} /> New Curve / Grid
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ftpRateCards.map((card) => (
            <RateCardCard key={card.id} card={card} onEdit={handleEditRateCard} onDelete={handleDeleteRateCard} />
          ))}
        </div>
      </div>

      {/* Edit Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title="Configuration Editor"
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={closeDrawer} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={handleSaveRateCard}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded"
            >
              Submit Change
            </button>
          </div>
        }
      >
        {editingRateCard && (
          <RateCardEditor
            editingRateCard={editingRateCard}
            onChange={(updates) => setEditingRateCard((prev) => (prev ? { ...prev, ...updates } : prev))}
          />
        )}
      </Drawer>
    </>
  );
};

export default RateCardsTab;
