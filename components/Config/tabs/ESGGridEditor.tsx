import React from 'react';
import {
  InputGroup,
  SelectInput,
  TextInput,
} from '../../ui/LayoutComponents';
import type { EditableEsgEntry } from './esgGridUtils';

interface Props {
  editingEsg: EditableEsgEntry;
  onChange: (nextItem: EditableEsgEntry) => void;
}

const ESGGridEditor: React.FC<Props> = ({
  editingEsg,
  onChange,
}) => (
  <div className="space-y-4">
    <InputGroup label={editingEsg.type === 'TRANSITION' ? 'Classification' : 'Risk Level'}>
      <SelectInput
        value={editingEsg.type === 'TRANSITION' ? editingEsg.classification : editingEsg.riskLevel}
        onChange={(event) => onChange(
          editingEsg.type === 'TRANSITION'
            ? { ...editingEsg, classification: event.target.value as typeof editingEsg.classification }
            : { ...editingEsg, riskLevel: event.target.value as typeof editingEsg.riskLevel },
        )}
      >
        {editingEsg.type === 'TRANSITION' ? (
          <>
            <option value="Green">Green</option>
            <option value="Neutral">Neutral</option>
            <option value="Amber">Amber</option>
            <option value="Brown">Brown</option>
          </>
        ) : (
          <>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </>
        )}
      </SelectInput>
    </InputGroup>

    <InputGroup label={editingEsg.type === 'TRANSITION' ? 'Sector' : 'Location / Asset Type'}>
      <TextInput
        value={editingEsg.type === 'TRANSITION' ? editingEsg.sector : editingEsg.locationType}
        onChange={(event) => onChange(
          editingEsg.type === 'TRANSITION'
            ? { ...editingEsg, sector: event.target.value }
            : { ...editingEsg, locationType: event.target.value },
        )}
      />
    </InputGroup>

    <InputGroup label="Description">
      <TextInput
        value={editingEsg.description}
        onChange={(event) => onChange({ ...editingEsg, description: event.target.value })}
      />
    </InputGroup>

    <InputGroup label="Adjustment (bps)">
      <TextInput
        type="number"
        value={editingEsg.adjustmentBps}
        onChange={(event) => onChange({ ...editingEsg, adjustmentBps: Number(event.target.value) || 0 })}
      />
    </InputGroup>
  </div>
);

export default ESGGridEditor;
