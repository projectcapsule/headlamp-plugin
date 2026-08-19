import { describe, expect, it } from 'vitest';
import {
  persistentVolumeCapacity,
  persistentVolumeClaim,
  persistentVolumeClaimForVolume,
  persistentVolumeClaimsForVolumes,
  persistentVolumesForTenant,
  tenantNameForPersistentVolume,
} from './persistentVolumeTenant';

function volume(name: string, tenant?: string, claimName = `${name}-claim`) {
  return {
    jsonData: {
      metadata: {
        labels: tenant ? { 'capsule.clastix.io/tenant': tenant } : {},
        name,
      },
      spec: {
        capacity: { storage: '20Gi' },
        claimRef: { name: claimName, namespace: 'solar-prod' },
      },
    },
    getName: () => name,
  };
}

function claim(name: string, volumeName?: string) {
  return {
    jsonData: {
      metadata: {
        labels: { 'projectcapsule.dev/tenant': 'solar' },
        name,
        namespace: 'solar-prod',
      },
      spec: { volumeName },
    },
  };
}

describe('PersistentVolume Tenant ownership', () => {
  it('uses only the authoritative Capsule label on PersistentVolumes', () => {
    expect(tenantNameForPersistentVolume(volume('data', 'solar'))).toBe('solar');
    expect(
      tenantNameForPersistentVolume({
        metadata: { labels: { 'projectcapsule.dev/tenant': 'wrong' } },
      })
    ).toBeUndefined();
  });

  it('filters exact Tenant PV matches and sorts them by name', () => {
    const result = persistentVolumesForTenant(
      [volume('zeta', 'solar'), volume('other', 'wind'), volume('alpha', 'solar')],
      'solar'
    );

    expect(result.map(item => item.getName())).toEqual(['alpha', 'zeta']);
    expect(persistentVolumeCapacity(result[0])).toBe('20Gi');
    expect(persistentVolumeClaim(result[0])).toEqual({
      name: 'alpha-claim',
      namespace: 'solar-prod',
    });
  });

  it('resolves the display PVC through claimRef with volumeName as fallback', () => {
    const referenced = claim('data');
    const fallback = claim('fallback', 'pv-fallback');
    const referencedVolume = volume('pv-reference', 'solar', 'data');
    const fallbackVolume = volume('pv-fallback', 'solar', 'missing');

    expect(persistentVolumeClaimForVolume(referencedVolume, [referenced, fallback])).toBe(
      referenced
    );
    expect(persistentVolumeClaimForVolume(fallbackVolume, [referenced, fallback])).toBe(fallback);
    expect(
      persistentVolumeClaimsForVolumes([fallback, referenced], [fallbackVolume, referencedVolume])
    ).toEqual([referenced, fallback]);
  });
});
