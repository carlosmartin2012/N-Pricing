import React from 'react';
import { Briefcase, Building2, Users } from 'lucide-react';
import {
  InputGroup,
  SelectInput,
  TextInput,
} from '../../ui/LayoutComponents';
import type {
  ClientEntity,
  ProductDefinition,
} from '../../../types';
import type { MasterDataEditorState } from './masterDataUtils';

interface Props {
  editorState: Exclude<MasterDataEditorState, null>;
  onChange: (nextValue: Exclude<MasterDataEditorState, null>['value']) => void;
}

const MasterDataEditor: React.FC<Props> = ({
  editorState,
  onChange,
}) => {
  if (editorState.kind === 'client') {
    return (
      <div className="space-y-4">
        <div className="mb-2 flex items-center gap-2 border-b border-slate-800 pb-2">
          <Users size={16} className="text-emerald-500" />
          <span className="text-xs font-bold uppercase text-slate-300">Client Details</span>
        </div>
        <InputGroup label="Client ID (Unique)">
          <TextInput
            value={editorState.value.id}
            onChange={(event) => onChange({ ...editorState.value, id: event.target.value })}
            placeholder="CL-XXXX"
            disabled={!editorState.isNew}
          />
        </InputGroup>
        <InputGroup label="Legal Entity Name">
          <TextInput
            value={editorState.value.name}
            onChange={(event) => onChange({ ...editorState.value, name: event.target.value })}
          />
        </InputGroup>
        <InputGroup label="Type">
          <SelectInput
            value={editorState.value.type}
            onChange={(event) => onChange({ ...editorState.value, type: event.target.value as ClientEntity['type'] })}
          >
            <option value="Corporate">Corporate</option>
            <option value="Retail">Retail</option>
            <option value="SME">SME</option>
            <option value="Institution">Institution</option>
          </SelectInput>
        </InputGroup>
        <InputGroup label="Segment">
          <TextInput
            value={editorState.value.segment}
            onChange={(event) => onChange({ ...editorState.value, segment: event.target.value })}
          />
        </InputGroup>
        <InputGroup label="Internal Rating">
          <SelectInput
            value={editorState.value.rating}
            onChange={(event) => onChange({ ...editorState.value, rating: event.target.value })}
          >
            <option>AAA</option>
            <option>AA</option>
            <option>A</option>
            <option>BBB</option>
            <option>BB</option>
            <option>B</option>
            <option>CCC</option>
          </SelectInput>
        </InputGroup>
      </div>
    );
  }

  if (editorState.kind === 'product') {
    return (
      <div className="space-y-4">
        <div className="mb-2 flex items-center gap-2 border-b border-slate-800 pb-2">
          <Briefcase size={16} className="text-cyan-500" />
          <span className="text-xs font-bold uppercase text-slate-300">Product Definition</span>
        </div>
        <InputGroup label="Product ID">
          <TextInput
            value={editorState.value.id}
            onChange={(event) => onChange({ ...editorState.value, id: event.target.value })}
            placeholder="LOAN_XXXX"
            disabled={!editorState.isNew}
          />
        </InputGroup>
        <InputGroup label="Product Name">
          <TextInput
            value={editorState.value.name}
            onChange={(event) => onChange({ ...editorState.value, name: event.target.value })}
          />
        </InputGroup>
        <InputGroup label="Category">
          <SelectInput
            value={editorState.value.category}
            onChange={(event) => onChange({ ...editorState.value, category: event.target.value as ProductDefinition['category'] })}
          >
            <option value="Asset">Asset (Loan)</option>
            <option value="Liability">Liability (Deposit)</option>
            <option value="Off-Balance">Off-Balance Sheet</option>
          </SelectInput>
        </InputGroup>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-2 border-b border-slate-800 pb-2">
        <Building2 size={16} className="text-purple-500" />
        <span className="text-xs font-bold uppercase text-slate-300">Business Unit</span>
      </div>
      <InputGroup label="Unit ID">
        <TextInput
          value={editorState.value.id}
          onChange={(event) => onChange({ ...editorState.value, id: event.target.value })}
          placeholder="BU-XXX"
          disabled={!editorState.isNew}
        />
      </InputGroup>
      <InputGroup label="Unit Name">
        <TextInput
          value={editorState.value.name}
          onChange={(event) => onChange({ ...editorState.value, name: event.target.value })}
        />
      </InputGroup>
      <InputGroup label="Code">
        <TextInput
          value={editorState.value.code}
          onChange={(event) => onChange({ ...editorState.value, code: event.target.value })}
          placeholder="Ex: CIB"
        />
      </InputGroup>
    </div>
  );
};

export default MasterDataEditor;
