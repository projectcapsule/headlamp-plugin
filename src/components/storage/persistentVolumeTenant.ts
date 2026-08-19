export const PERSISTENT_VOLUME_TENANT_LABEL = 'capsule.clastix.io/tenant';

export function persistentVolumeData(volume: any) {
  return volume?.jsonData || volume || {};
}

export function persistentVolumeName(volume: any): string {
  return persistentVolumeData(volume)?.metadata?.name || volume?.getName?.() || '';
}

export function tenantNameForPersistentVolume(volume: any): string | undefined {
  const value = persistentVolumeData(volume)?.metadata?.labels?.[PERSISTENT_VOLUME_TENANT_LABEL];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function persistentVolumesForTenant(volumes: any[] | null | undefined, tenantName: string) {
  return (volumes || [])
    .filter(volume => tenantNameForPersistentVolume(volume) === tenantName)
    .sort((left, right) => persistentVolumeName(left).localeCompare(persistentVolumeName(right)));
}

export function persistentVolumeClaimForVolume(volume: any, claims: any[] | null | undefined) {
  const volumeData = persistentVolumeData(volume);
  const claimRef = volumeData?.spec?.claimRef;
  if (claimRef?.name && claimRef?.namespace) {
    const referenced = (claims || []).find(claim => {
      const claimData = persistentVolumeData(claim);
      return (
        claimData?.metadata?.name === claimRef.name &&
        claimData?.metadata?.namespace === claimRef.namespace
      );
    });
    if (referenced) return referenced;
  }

  const volumeName = persistentVolumeName(volume);
  if (!volumeName) return undefined;
  return (claims || []).find(claim => persistentVolumeData(claim)?.spec?.volumeName === volumeName);
}

export function persistentVolumeClaimsForVolumes(
  claims: any[] | null | undefined,
  volumes: any[] | null | undefined
) {
  const related = new Map<string, any>();
  (volumes || []).forEach(volume => {
    const claim = persistentVolumeClaimForVolume(volume, claims);
    const claimData = persistentVolumeData(claim);
    const name = claimData?.metadata?.name;
    if (!name) return;
    const namespace = claimData?.metadata?.namespace || '';
    related.set(`${namespace}/${name}`, claim);
  });
  return [...related.values()].sort((left, right) => {
    const leftData = persistentVolumeData(left);
    const rightData = persistentVolumeData(right);
    const leftKey = `${leftData.metadata?.namespace || ''}/${leftData.metadata?.name || ''}`;
    const rightKey = `${rightData.metadata?.namespace || ''}/${rightData.metadata?.name || ''}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function persistentVolumeCapacity(volume: any): string {
  return persistentVolumeData(volume)?.spec?.capacity?.storage || '—';
}

export function persistentVolumePhase(volume: any): string {
  return persistentVolumeData(volume)?.status?.phase || 'Unknown';
}

export function persistentVolumeClaim(
  volume: any
): { name: string; namespace?: string } | undefined {
  const claim = persistentVolumeData(volume)?.spec?.claimRef;
  if (!claim?.name) return undefined;
  return { name: claim.name, namespace: claim.namespace };
}
