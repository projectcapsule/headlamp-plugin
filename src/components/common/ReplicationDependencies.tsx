import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { SimpleTable } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import {
  getReplicationDependencies,
  type ReplicationDependency,
} from '../../resources/tenantResources';
import { CapsuleResourceLink } from './CapsuleResourceLink';

function DependencyLink({ dependency }: { dependency: ReplicationDependency }) {
  return (
    <CapsuleResourceLink
      crd={
        dependency.kind === 'TenantResource'
          ? CAPSULE_CRDS.TenantResource
          : CAPSULE_CRDS.GlobalTenantResource
      }
      name={dependency.name}
      namespace={dependency.namespace}
    >
      {dependency.name}
    </CapsuleResourceLink>
  );
}

export function ReplicationDependencyStateChip({
  dependency,
}: {
  dependency: ReplicationDependency;
}) {
  return <Chip size="small" color={dependency.color} label={dependency.state} />;
}

export function ReplicationDependenciesCell({
  item,
  candidates,
}: {
  item: any;
  candidates: any[];
}) {
  const dependencies = getReplicationDependencies(item, candidates);
  if (dependencies.length === 0) return <Typography color="text.secondary">—</Typography>;

  return (
    <Stack spacing={0.5} sx={{ minWidth: 180 }}>
      {dependencies.map((dependency, index) => (
        <Box
          key={`${dependency.namespace || 'cluster'}-${dependency.name}-${index}`}
          sx={{ alignItems: 'center', display: 'flex', gap: 0.75, minWidth: 0 }}
        >
          <Box sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <DependencyLink dependency={dependency} />
          </Box>
          <ReplicationDependencyStateChip dependency={dependency} />
        </Box>
      ))}
    </Stack>
  );
}

export function ReplicationDependenciesSection({
  dependencies,
}: {
  dependencies: ReplicationDependency[];
}) {
  if (dependencies.length === 0) return null;

  return (
    <SectionBox title="Dependencies">
      <SimpleTable
        columns={[
          {
            label: 'Name',
            getter: (dependency: ReplicationDependency) => (
              <DependencyLink dependency={dependency} />
            ),
          },
          {
            label: 'Namespace',
            getter: (dependency: ReplicationDependency) => dependency.namespace || 'Cluster',
          },
          {
            label: 'Ready state',
            getter: (dependency: ReplicationDependency) => (
              <ReplicationDependencyStateChip dependency={dependency} />
            ),
          },
          {
            label: 'Message',
            getter: (dependency: ReplicationDependency) => dependency.message,
          },
        ]}
        data={dependencies}
        emptyMessage="No dependencies declared."
        reflectInURL={false}
      />
    </SectionBox>
  );
}
