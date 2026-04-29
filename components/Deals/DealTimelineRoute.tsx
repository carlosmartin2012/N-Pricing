import React, { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import DealTimelineView from './DealTimelineView';

/**
 * Route wrapper for /deals/:id/timeline.
 *
 * Reads the dealId from the URL, the optional ?focus=<eventId> query
 * param (used by deep-links from /escalations and /dossiers banners
 * in A.7) and forwards a navigation handler that opens
 * /snapshots?focus=<snapshotId> for replay flows.
 *
 * Kept thin on purpose: DealTimelineView takes plain props so it can
 * be embedded in tests/stories/drawers without dragging React Router
 * setup along.
 */
const DealTimelineRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const focusEventId = searchParams.get('focus') ?? undefined;

  const onReplaySnapshot = useCallback(
    (snapshotId: string) => {
      navigate(`/snapshots?focus=${encodeURIComponent(snapshotId)}`);
    },
    [navigate],
  );

  return (
    <DealTimelineView
      dealId={id ?? ''}
      focusEventId={focusEventId}
      onReplaySnapshot={onReplaySnapshot}
    />
  );
};

export default DealTimelineRoute;
