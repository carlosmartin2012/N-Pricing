/**
 * Attributions namespace (EN). Ola 8 — Atribuciones jerárquicas (Bloque B).
 *
 * Scope: Approval Cockpit, Attribution Simulator and Matrix Editor copy.
 */

interface AttributionsPack {
  [key: string]: string;
}

export const attributionsEn: AttributionsPack = {
  // Navigation / view headers
  attributionsView:               'Approvals',
  attributionsMatrixView:         'Attribution matrix',

  // Approval Cockpit
  cockpitTitle:                   'My approvals',
  cockpitSubtitle:                'Pending decisions you can act on',
  cockpitMyLevel:                 'My attribution level',
  cockpitNoLevel:                 'You are not assigned to any attribution level',
  cockpitPendingCount:            'Pending',
  cockpitAggregateVolume:         'Aggregate volume',
  cockpitMeanRaroc:               'Mean RAROC',
  cockpitMeanDrift:               'Mean drift',
  cockpitEmpty:                   'Nothing pending — every deal is decided.',
  cockpitDeal:                    'Deal',
  cockpitClient:                  'Client',
  cockpitProduct:                 'Product',
  cockpitDeviation:               'Δbps',
  cockpitRaroc:                   'RAROC',
  cockpitVolume:                  'Volume',
  cockpitAction:                  'Action',
  cockpitApprove:                 'Approve',
  cockpitReject:                  'Reject',
  cockpitEscalate:                'Escalate',
  cockpitNeedsLevel:              'Needs {level}',
  cockpitDecisionReason:          'Reason (optional)',
  cockpitConfirmApprove:          'Confirm approval',
  cockpitConfirmReject:           'Confirm rejection',
  cockpitConfirmEscalate:         'Confirm escalation',
  cockpitBelowFloorBlocked:       'Below regulatory floor — cannot approve',
  cockpitErrorLoading:            'Could not load decisions. Retry.',

  // Simulator
  simulatorTitle:                 'Attribution simulator',
  simulatorSubtitle:              'Tweak levers and see who can approve',
  simulatorDeviationLabel:        'Margin (bps delta)',
  simulatorRarocOverrideLabel:    'RAROC override (pp)',
  simulatorTenorDeltaLabel:       'Tenor delta (months)',
  simulatorCrossSellLabel:        'Cross-sell (€)',
  simulatorBaselinePrice:         'Baseline price',
  simulatorAdjustedPrice:         'Adjusted price',
  simulatorBaselineRaroc:         'Baseline RAROC',
  simulatorAdjustedRaroc:         'Adjusted RAROC',
  simulatorRequiredLevel:         'Required level',
  simulatorChainShort:            'Chain',
  simulatorTimeAvoided:           'Approval levels avoided',
  simulatorBelowFloor:            'Below regulatory floor — UI will block approve',
  simulatorReasonWithin:          'Within threshold',
  simulatorReasonDeviation:       'Deviation exceeds tier',
  simulatorReasonRaroc:           'RAROC below tier minimum',
  simulatorReasonVolume:          'Volume above tier ceiling',
  simulatorReasonNoMatch:         'No threshold matches scope',
  simulatorReasonHardFloor:       'Below hard floor',
  simulatorApply:                 'Apply to deal',
  simulatorRequest:               'Request approval',
  simulatorReset:                 'Reset',

  // Matrix editor
  matrixTitle:                    'Attribution matrix',
  matrixSubtitle:                 'Hierarchy and thresholds for this entity',
  matrixAddLevel:                 'Add level',
  matrixAddThreshold:             'Add threshold',
  matrixLevelName:                'Name',
  matrixLevelOrder:               'Order',
  matrixLevelRole:                'Role',
  matrixLevelParent:              'Parent',
  matrixLevelActive:              'Active',
  matrixLevelDeactivate:          'Deactivate',
  matrixThresholdScope:           'Scope',
  matrixThresholdDeviation:       'Max Δbps',
  matrixThresholdRaroc:           'Min RAROC',
  matrixThresholdVolume:          'Max volume',
  matrixThresholdActiveFrom:      'From',
  matrixThresholdActiveTo:        'To',
  matrixEmpty:                    'No attribution levels configured. Add Office, Zone, Territorial and Committee to start.',
  matrixSaveSuccess:               'Saved',
  matrixSaveError:                'Could not save — review and retry',
  matrixCancel:                   'Cancel',
  matrixSave:                     'Save',
  matrixForbidden:                'Only Admin or Risk Manager can edit the matrix',

  // Reporting (Ola 8 Bloque C)
  reportingView:                  'Attribution reporting',
  reportingSubtitle:              'Volume, drift and decision funnel by level and user',
  reportingTabVolume:             'Volume',
  reportingTabDrift:              'Drift',
  reportingTabFunnel:             'Funnel',
  reportingTabTimeToDecision:     'Time-to-decision',
  reportingWindow30:              '30d',
  reportingWindow90:              '90d',
  reportingWindow180:             '180d',
  reportingTotalDecisions:        'Decisions',
  reportingByLevelTitle:          'Volume by level',
  reportingByUserTitle:           'Mean drift by user',
  reportingDriftEmpty:            'No systematic drift detected — every approver stays within band.',
  reportingDriftSeverityWarning:  'Warning',
  reportingDriftSeverityBreached: 'Breached',
  reportingFunnelApproved:        'Approved',
  reportingFunnelRejected:        'Rejected',
  reportingFunnelEscalated:       'Escalated',
  reportingFunnelExpired:         'Expired',
  reportingFunnelReverted:        'Reverted',
  reportingFunnelEmpty:           'No decisions in the window.',
  reportingTimeNotAvailable:      'Time-to-decision requires audit pairs (open → resolved). Coming soon.',

  // Generic
  loading:                        'Loading…',
  retry:                          'Retry',
};

export type AttributionsTranslationKeys = typeof attributionsEn;
