import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { insertDetailsSectionBefore } from '../namespaces/namespaceDetailsSections';
import { persistentVolumeClaim, tenantNameForPersistentVolume } from './persistentVolumeTenant';
import { TenantPersistentVolumeFlow } from './TenantPersistentVolumeFlow';

export const CAPSULE_PERSISTENT_VOLUME_TENANT_SECTION_ID =
  'capsule.persistentvolume-tenant-relation';

function objectKind(resource: any): string {
  return resource?.kind || resource?.jsonData?.kind || resource?.constructor?.kind || '';
}

function BoundPersistentVolumeTenantFlow({
  claimName,
  claimNamespace,
  tenantName,
  volume,
}: {
  claimName: string;
  claimNamespace: string;
  tenantName: string;
  volume: any;
}) {
  const [claim] = K8s.ResourceClasses.PersistentVolumeClaim.useGet(claimName, claimNamespace, {
    cluster: volume?.cluster,
  });
  return (
    <TenantPersistentVolumeFlow
      claims={claim ? [claim] : []}
      tenantName={tenantName}
      volumes={[volume]}
    />
  );
}

export function PersistentVolumeTenantRelation({
  tenantName,
  volume,
}: {
  tenantName: string;
  volume: any;
}) {
  const claimRef = persistentVolumeClaim(volume);

  return (
    <SectionBox title="Tenant relationship">
      {claimRef?.name && claimRef.namespace ? (
        <BoundPersistentVolumeTenantFlow
          claimName={claimRef.name}
          claimNamespace={claimRef.namespace}
          tenantName={tenantName}
          volume={volume}
        />
      ) : (
        <TenantPersistentVolumeFlow claims={[]} tenantName={tenantName} volumes={[volume]} />
      )}
    </SectionBox>
  );
}

/** Adds a relation view only to PVs carrying Capsule's Tenant ownership label. */
export function processPersistentVolumeDetailsSections(resource: any, sections: any[]) {
  if (objectKind(resource) !== 'PersistentVolume') return sections;
  const tenantName = tenantNameForPersistentVolume(resource);
  if (!tenantName) return sections;

  return insertDetailsSectionBefore(
    sections,
    {
      id: CAPSULE_PERSISTENT_VOLUME_TENANT_SECTION_ID,
      section: <PersistentVolumeTenantRelation tenantName={tenantName} volume={resource} />,
    },
    'EVENTS'
  );
}
