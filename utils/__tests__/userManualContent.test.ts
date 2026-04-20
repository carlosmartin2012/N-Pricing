import { describe, expect, it } from 'vitest';
import { getUserManualContent } from '../userManualContent';

describe('userManualContent', () => {
  it('returns a structured Spanish manual with quick start and workflows', () => {
    const content = getUserManualContent('es');

    expect(content.hero.title).toContain('N Pricing');
    expect(content.quickStart).toHaveLength(5);
    expect(content.quickStart[0].title).toContain('modo');
    expect(content.workflows.length).toBeGreaterThanOrEqual(4);
    expect(content.workflows.some((workflow) => workflow.title.includes('Pricing'))).toBe(true);
    expect(content.dataModes.demo.title).toContain('DEMO');
    expect(content.troubleshooting.length).toBeGreaterThanOrEqual(4);
  });

  it('returns an English manual with role-based workflows and help guidance', () => {
    const content = getUserManualContent('en');

    expect(content.hero.title).toContain('N Pricing');
    expect(content.workflows.some((workflow) => workflow.title.includes('committee') || workflow.title.includes('Committee'))).toBe(true);
    expect(content.dataModes.live.title).toContain('LIVE');
    expect(content.supportChecklist.length).toBeGreaterThanOrEqual(4);
    expect(content.quickStart.some((step) => step.title.toLowerCase().includes('deal') || step.title.toLowerCase().includes('scenario'))).toBe(true);
  });
});
