/**
 * Originally the home of the empty-state banner; promoted to
 * `components/ui/EmptyStateBanner.tsx` once ControlRoom, Pipeline and
 * Campaigns started needing the same shape.
 *
 * Kept as a re-export so existing imports (CustomerRelationshipPanel,
 * stories, tests) keep working without a coordinated rename PR.
 */
export { default, ImportIcon, InitializeIcon } from '../ui/EmptyStateBanner';
