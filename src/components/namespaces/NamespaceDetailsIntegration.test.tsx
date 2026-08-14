import { MetadataDisplay } from '@kinvolk/headlamp-plugin/lib/components/common';
import React, { Children, isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { processNamespaceDetailsSections } from './NamespaceDetailsIntegration';
import {
  CAPSULE_NAMESPACE_QUOTA_SECTION_ID,
  HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID,
} from './namespaceDetailsSections';

vi.hoisted(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

vi.mock('@kinvolk/headlamp-plugin/lib/components/common', () => ({
  MetadataDisplay: () => null,
}));
vi.mock('../../resources/tenants', () => ({
  Tenants: { useList: () => [[]] },
}));
vi.mock('../common/CapsuleResourceLink', () => ({
  CapsuleResourceLink: () => null,
}));
vi.mock('./NamespaceQuotaSystems', () => ({
  NamespaceQuotaSystems: () => null,
}));

describe('Namespace details processor', () => {
  it('adds linked Tenant metadata and orders Capsule quotas before ResourceQuotas', () => {
    const namespace = {
      kind: 'Namespace',
      metadata: {
        labels: { 'capsule.clastix.io/tenant': 'solar' },
        name: 'solar-test',
      },
    };
    const metadata = (
      <div>
        <MetadataDisplay
          resource={namespace as any}
          extraRows={() => [{ name: 'Status', value: 'Active' }]}
        />
      </div>
    );
    const sections = processNamespaceDetailsSections(namespace, [
      { id: 'METADATA', section: metadata },
      { id: HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID, section: <div /> },
    ]);

    expect(sections.map(section => section.id)).toEqual([
      'METADATA',
      CAPSULE_NAMESPACE_QUOTA_SECTION_ID,
      HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID,
    ]);

    const metadataSection = sections[0].section as React.ReactElement<any>;
    const metadataDisplay = Children.toArray(metadataSection.props.children).find(
      child => isValidElement(child) && child.type === MetadataDisplay
    ) as React.ReactElement<any>;
    const rows = metadataDisplay.props.extraRows(namespace);
    expect(rows.map((row: any) => row.name)).toEqual(['Status', 'Tenant']);
    expect(rows[1].value.props.namespace).toBe(namespace);
  });
});
