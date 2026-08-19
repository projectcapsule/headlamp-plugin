import { Link, ResourceListView, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import type { ChipProps } from '@mui/material';
import { Box, Chip } from '@mui/material';
import {
  persistentVolumeCapacity,
  persistentVolumeClaim,
  persistentVolumeData,
  persistentVolumeName,
  persistentVolumePhase,
} from './persistentVolumeTenant';
import { TenantPersistentVolumeFlow } from './TenantPersistentVolumeFlow';

function phaseColor(phase: string): ChipProps['color'] {
  if (phase === 'Bound') return 'info';
  if (phase === 'Available') return 'success';
  if (phase === 'Failed') return 'error';
  if (phase === 'Released') return 'warning';
  return 'default';
}

export function TenantPersistentVolumes({
  claims,
  tenantName,
  volumes,
}: {
  claims: any[];
  tenantName: string;
  volumes: any[];
}) {
  return (
    <SectionBox title="Persistent Volumes">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
        <TenantPersistentVolumeFlow claims={claims} tenantName={tenantName} volumes={volumes} />

        <Box sx={{ minWidth: 0 }}>
          <ResourceListView
            id="capsule-tenant-persistent-volumes"
            title={null}
            data={volumes}
            defaultSortingColumn={{ id: 'name', desc: false }}
            headerProps={{ noNamespaceFilter: true }}
            reflectInURL={false}
            columns={[
              {
                id: 'name',
                label: 'Name',
                getValue: persistentVolumeName,
                render: (volume: any) => (
                  <Link
                    routeName="persistentVolume"
                    params={{ name: persistentVolumeName(volume) }}
                    activeCluster={volume?.cluster}
                    tooltip
                  >
                    {persistentVolumeName(volume)}
                  </Link>
                ),
              },
              {
                id: 'capacity',
                label: 'Capacity',
                getValue: persistentVolumeCapacity,
              },
              {
                id: 'claim',
                label: 'Claim',
                getValue: (volume: any) => {
                  const claim = persistentVolumeClaim(volume);
                  return claim ? `${claim.namespace || ''}/${claim.name}` : '';
                },
                render: (volume: any) => {
                  const claim = persistentVolumeClaim(volume);
                  if (!claim) return '—';
                  return (
                    <Link
                      routeName="persistentVolumeClaim"
                      params={{ namespace: claim.namespace, name: claim.name }}
                      activeCluster={volume?.cluster}
                      tooltip
                    >
                      {claim.namespace ? `${claim.namespace}/` : ''}
                      {claim.name}
                    </Link>
                  );
                },
              },
              {
                id: 'storage-class',
                label: 'Storage Class',
                filterVariant: 'multi-select',
                getValue: (volume: any) =>
                  persistentVolumeData(volume)?.spec?.storageClassName || '',
                render: (volume: any) => {
                  const storageClass = persistentVolumeData(volume)?.spec?.storageClassName;
                  if (!storageClass) return '—';
                  return (
                    <Link
                      routeName="storageClass"
                      params={{ name: storageClass }}
                      activeCluster={volume?.cluster}
                      tooltip
                    >
                      {storageClass}
                    </Link>
                  );
                },
              },
              {
                id: 'reclaim-policy',
                label: 'Reclaim Policy',
                filterVariant: 'multi-select',
                getValue: (volume: any) =>
                  persistentVolumeData(volume)?.spec?.persistentVolumeReclaimPolicy || '',
              },
              {
                id: 'phase',
                label: 'Status',
                filterVariant: 'multi-select',
                getValue: persistentVolumePhase,
                render: (volume: any) => {
                  const phase = persistentVolumePhase(volume);
                  return <Chip color={phaseColor(phase)} label={phase} size="small" />;
                },
              },
              'age',
            ]}
          />
        </Box>
      </Box>
    </SectionBox>
  );
}

export default TenantPersistentVolumes;
