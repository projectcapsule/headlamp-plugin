import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  CAPSULE_PERSISTENT_VOLUME_TENANT_SECTION_ID,
  processPersistentVolumeDetailsSections,
} from './PersistentVolumeTenantIntegration';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  K8s: {
    ResourceClasses: {
      PersistentVolumeClaim: { useGet: () => [null] },
    },
  },
}));
vi.mock('@kinvolk/headlamp-plugin/lib/components/common', () => ({
  SectionBox: ({ children }: any) => children,
}));
vi.mock('./TenantPersistentVolumeFlow', () => ({
  TenantPersistentVolumeFlow: () => null,
}));

describe('PersistentVolume Tenant details processor', () => {
  it('adds a lazy PVC-owned relation section before Events for bound PVs', () => {
    const volume = {
      kind: 'PersistentVolume',
      metadata: {
        labels: { 'capsule.clastix.io/tenant': 'solar' },
        name: 'solar-data',
      },
      spec: { claimRef: { name: 'data', namespace: 'solar-prod' } },
    };
    const sections = processPersistentVolumeDetailsSections(volume, [
      { id: 'METADATA', section: <div /> },
      { id: 'EVENTS', section: <div /> },
    ]);

    expect(sections.map(section => section.id)).toEqual([
      'METADATA',
      CAPSULE_PERSISTENT_VOLUME_TENANT_SECTION_ID,
      'EVENTS',
    ]);
    expect(sections[1].section.props.volume).toBe(volume);
    expect(sections[1].section.props.tenantName).toBe('solar');
  });

  it('leaves unlabeled PVs and other resource kinds untouched', () => {
    const sections = [{ id: 'METADATA', section: <div /> }];
    expect(
      processPersistentVolumeDetailsSections(
        { kind: 'PersistentVolume', metadata: { name: 'unowned' } },
        sections
      )
    ).toBe(sections);
    expect(processPersistentVolumeDetailsSections({ kind: 'Pod' }, sections)).toBe(sections);
  });
});
