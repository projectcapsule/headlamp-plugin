import { describe, expect, it } from 'vitest';
import {
  CAPSULE_NAMESPACE_QUOTA_SECTION_ID,
  HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID,
  insertDetailsSectionBefore,
  tenantNameForNamespace,
} from './namespaceDetailsSections';

describe('Namespace details integration', () => {
  it('inserts Capsule quota systems immediately before ResourceQuotas', () => {
    const sections = [
      { id: 'metadata' },
      { id: HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID },
      { id: 'limitranges' },
    ];
    const result = insertDetailsSectionBefore(
      sections,
      { id: CAPSULE_NAMESPACE_QUOTA_SECTION_ID },
      HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID
    );

    expect(result.map(section => section.id)).toEqual([
      'metadata',
      CAPSULE_NAMESPACE_QUOTA_SECTION_ID,
      HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID,
      'limitranges',
    ]);
  });

  it('does not duplicate an already inserted section', () => {
    const sections = [{ id: CAPSULE_NAMESPACE_QUOTA_SECTION_ID }];
    expect(
      insertDetailsSectionBefore(
        sections,
        { id: CAPSULE_NAMESPACE_QUOTA_SECTION_ID },
        HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID
      )
    ).toBe(sections);
  });

  it('uses the Namespace Tenant label before status fallback', () => {
    const tenants = [{ metadata: { name: 'fallback' }, status: { spaces: { 'solar-test': {} } } }];
    expect(
      tenantNameForNamespace(
        {
          metadata: {
            name: 'solar-test',
            labels: { 'capsule.clastix.io/tenant': 'solar' },
          },
        },
        tenants
      )
    ).toBe('solar');
    expect(tenantNameForNamespace({ metadata: { name: 'solar-test' } }, tenants)).toBe('fallback');
  });
});
