import React, { useState } from 'react';
import { saveApprovalTasks, saveMethodologyChangeRequests } from '../../../api/config';
import { Drawer } from '../../ui/Drawer';
import { Plus } from 'lucide-react';
import { useAudit } from '../../../hooks/useAudit';
import { useData } from '../../../contexts/DataContext';
import type { GreeniumRateCard, PhysicalRateCard, TransitionRateCard } from '../../../types';
import {
  buildApprovalTaskForMethodologyChange,
  buildConfigChangeOperation,
  buildMethodologyChangeRequest,
  upsertApprovalTask,
  upsertMethodologyChangeRequest,
} from '../../../utils/governanceWorkflows';
import type { ConfigUser } from '../configTypes';
import ESGGridEditor from './ESGGridEditor';
import ESGGridTable from './ESGGridTable';
import {
  createDefaultEsgEntry,
  createEditableEsgEntry,
  toPersistedEsgEntry,
  type EditableEsgEntry,
  type EsgSubTab,
} from './esgGridUtils';

interface Props {
  transitionGrid: TransitionRateCard[];
  setTransitionGrid: React.Dispatch<React.SetStateAction<TransitionRateCard[]>>;
  physicalGrid: PhysicalRateCard[];
  setPhysicalGrid: React.Dispatch<React.SetStateAction<PhysicalRateCard[]>>;
  greeniumGrid: GreeniumRateCard[];
  setGreeniumGrid: React.Dispatch<React.SetStateAction<GreeniumRateCard[]>>;
  user: ConfigUser;
}

const ESGGridTab: React.FC<Props> = ({ transitionGrid, physicalGrid, greeniumGrid, user }) => {
  const data = useData();
  const logAudit = useAudit(user);
  const [esgSubTab, setEsgSubTab] = useState<EsgSubTab>('TRANSITION');
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [editingEsg, setEditingEsg] = useState<EditableEsgEntry | null>(null);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingEsg(null);
  };

  const handleEditEsg = (item: TransitionRateCard | PhysicalRateCard | GreeniumRateCard) => {
    setEditingEsg(createEditableEsgEntry(esgSubTab, item));
    setDrawerOpen(true);
  };

  const handleAddEsg = () => {
    setEditingEsg(createDefaultEsgEntry(esgSubTab));
    setDrawerOpen(true);
  };

  const handleSaveEsg = async () => {
    if (editingEsg) {
      const type = editingEsg.type === 'TRANSITION' ? 'transition' : editingEsg.type === 'GREENIUM' ? 'greenium' : 'physical';
      const target = editingEsg.type === 'TRANSITION' ? 'TRANSITION_GRID' : editingEsg.type === 'GREENIUM' ? 'GREENIUM_GRID' : 'PHYSICAL_GRID';
      const nextItem = toPersistedEsgEntry(editingEsg) as TransitionRateCard | PhysicalRateCard | GreeniumRateCard;
      const currentGrid = editingEsg.type === 'TRANSITION' ? transitionGrid : editingEsg.type === 'GREENIUM' ? greeniumGrid : physicalGrid;
      const existing = currentGrid.find((item) => item.id === nextItem.id);
      const request = buildMethodologyChangeRequest({
        title: `${existing ? 'Update' : 'Create'} ${type} ESG entry`,
        reason: `${existing ? 'Update' : 'Create'} ESG ${type} entry ${String(nextItem.id)}`,
        action: existing ? 'UPDATE' : 'CREATE',
        userEmail: user?.email || 'unknown',
        userName: user?.name || 'Unknown User',
        operations: [
          buildConfigChangeOperation(target, existing ? 'UPDATE' : 'CREATE', {
            currentItem: existing,
            proposedItem: nextItem,
            summary: `${existing ? 'UPDATE' : 'CREATE'} ESG ${type} entry ${String(nextItem.id)}`,
          }),
        ],
      });
      const approvalTask = buildApprovalTaskForMethodologyChange(request, 'Admin');
      const nextRequests = upsertMethodologyChangeRequest(data.methodologyChangeRequests, request);
      const nextTasks = upsertApprovalTask(data.approvalTasks, approvalTask);
      data.setMethodologyChangeRequests(nextRequests);
      data.setApprovalTasks(nextTasks);
      await Promise.all([
        saveMethodologyChangeRequests(nextRequests),
        saveApprovalTasks(nextTasks),
      ]);

      logAudit({
        action: existing ? 'SUBMIT_ESG_UPDATE' : 'SUBMIT_ESG_CREATE',
        module: 'SYS_CONFIG',
        description: `${existing ? 'Submitted update' : 'Submitted creation'} for ESG ${type} entry: ${editingEsg.type === 'TRANSITION' ? editingEsg.classification : editingEsg.type === 'GREENIUM' ? editingEsg.greenFormat : editingEsg.riskLevel}`,
        details: {
          changeRequestId: request.id,
          approvalTaskId: approvalTask.id,
          target,
          entryId: nextItem.id,
        },
      });

      closeDrawer();
    }
  };

  const targetMap: Record<EsgSubTab, string> = { TRANSITION: 'TRANSITION_GRID', PHYSICAL: 'PHYSICAL_GRID', GREENIUM: 'GREENIUM_GRID' };
  const pendingRequests = data.methodologyChangeRequests.filter(
    (request) =>
      request.target === targetMap[esgSubTab] &&
      ['Pending_Review', 'Approved'].includes(request.status)
  ).length;

  return (
    <>
      {pendingRequests > 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
          {pendingRequests} ESG request{pendingRequests === 1 ? '' : 's'} waiting in governance for this grid.
        </div>
      )}

      {/* ESG Sub-Tabs */}
      <div className="flex bg-slate-900 border-b border-slate-700">
        <button
          onClick={() => setEsgSubTab('TRANSITION')}
          className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-wider ${esgSubTab === 'TRANSITION' ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Transition Risk (Carbon)
        </button>
        <button
          onClick={() => setEsgSubTab('PHYSICAL')}
          className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-wider ${esgSubTab === 'PHYSICAL' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Physical Risk (Climate)
        </button>
        <button
          onClick={() => setEsgSubTab('GREENIUM')}
          className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-wider ${esgSubTab === 'GREENIUM' ? 'bg-slate-800 text-teal-400 border-b-2 border-teal-500' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Greenium / Movilización
        </button>
      </div>

      {/* ESG Toolbar */}
      <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <div className="text-[10px] text-slate-500">
          {esgSubTab === 'TRANSITION'
            ? 'Penalties for high-carbon, incentives for green. Changes now flow through governance.'
            : esgSubTab === 'GREENIUM'
            ? 'Greenium discounts for verified green-format instruments. Changes flow through governance.'
            : 'Premiums for asset location risk exposure. Changes now flow through governance.'}
        </div>
        <button
          onClick={handleAddEsg}
          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-900/30 text-emerald-400 rounded border border-emerald-800 text-xs hover:bg-emerald-900/50"
        >
          <Plus size={12} /> Add Entry
        </button>
      </div>

      {/* ESG Grids */}
      <ESGGridTable
        esgSubTab={esgSubTab}
        items={esgSubTab === 'TRANSITION' ? transitionGrid : esgSubTab === 'GREENIUM' ? greeniumGrid : physicalGrid}
        onEdit={handleEditEsg}
      />

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
              onClick={handleSaveEsg}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded"
            >
              Submit Change
            </button>
          </div>
        }
      >
        {editingEsg && <ESGGridEditor editingEsg={editingEsg} onChange={setEditingEsg} />}
      </Drawer>
    </>
  );
};

export default ESGGridTab;
