import { describe, expect, it } from 'vitest';
import {
  getSelectedTenantContexts,
  parseStoredTenantSelection,
  readSelectedTenantNames,
} from './tenantContext';

describe('Tenant context selection', () => {
  it('treats an empty selection as All Tenants', () => {
    expect(parseStoredTenantSelection(null)).toEqual([]);
    expect(parseStoredTenantSelection('[]')).toEqual([]);
  });

  it('supports current and legacy stored selection shapes', () => {
    expect(parseStoredTenantSelection('["solar-dev","solar-prod"]')).toEqual([
      'solar-dev',
      'solar-prod',
    ]);
    expect(parseStoredTenantSelection('"solar-dev"')).toEqual(['solar-dev']);
    expect(parseStoredTenantSelection('{"metadata":{"name":"solar-dev"}}')).toEqual(['solar-dev']);
    expect(parseStoredTenantSelection('solar-dev')).toEqual(['solar-dev']);
  });

  it('uses the first populated storage key', () => {
    const values: Record<string, string> = { selectedTenantName: '"legacy"' };
    expect(readSelectedTenantNames({ getItem: key => values[key] || null })).toEqual(['legacy']);
  });

  it('builds one annotated context per selected Tenant in selector order', () => {
    const tenants = [
      {
        metadata: {
          name: 'solar-dev',
          annotations: {
            'info.projectcapsule.dev/icon': 'mdi:white-balance-sunny',
            'info.projectcapsule.dev/links':
              '[{"title":"Dashboard","url":"https://example.com/dev"}]',
          },
        },
      },
      { metadata: { name: 'solar-prod' } },
    ];

    expect(getSelectedTenantContexts(tenants, ['solar-prod', 'solar-dev', 'missing'])).toEqual([
      { name: 'solar-prod', icon: undefined, links: [] },
      {
        name: 'solar-dev',
        icon: 'mdi:white-balance-sunny',
        links: [{ title: 'Dashboard', url: 'https://example.com/dev' }],
      },
    ]);
  });
});
