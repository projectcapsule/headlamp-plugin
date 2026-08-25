import { describe, expect, it } from 'vitest';
import { anchoredResourceListHeaderProps, sectionAnchorId } from './SectionAnchor';

describe('section anchors', () => {
  it('creates readable stable fragment identifiers from section titles', () => {
    expect(sectionAnchorId('Namespace Consumption')).toBe('namespace-consumption');
    expect(sectionAnchorId('RBAC and Controller Overrides')).toBe('rbac-and-controller-overrides');
    expect(sectionAnchorId('Tenant Info & Appearance (optional)')).toBe(
      'tenant-info-appearance-optional'
    );
  });

  it('normalizes accented text and has a safe fallback', () => {
    expect(sectionAnchorId('Résumé Status')).toBe('resume-status');
    expect(sectionAnchorId('***')).toBe('section');
  });

  it('preserves ResourceListView actions without overriding title-side create actions', () => {
    const headerProps = anchoredResourceListHeaderProps('Tenant Resources', {
      headerProps: { actions: ['existing-action'], noNamespaceFilter: true },
    });

    expect(headerProps.noNamespaceFilter).toBe(true);
    expect(headerProps.actions).toHaveLength(2);
    expect(headerProps.actions[0]).toBe('existing-action');
    expect(headerProps).not.toHaveProperty('titleSideActions');
  });
});
