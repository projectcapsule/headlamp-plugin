import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { TenantOwner } from '../../resources/tenantOwners';
import { Tenants } from '../../resources/tenants';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import { referencedTenantsForOwner, tenantOwnerIdentity } from './tenantOwnerReferences';

function readyCondition(item: any) {
  return item.status?.conditions?.find((condition: any) => condition.type === 'Ready');
}

export function TenantOwnersList() {
  const [items, error] = TenantOwner.useList();
  const [tenants] = Tenants.useList();
  const stats = useMemo(() => {
    let ready = 0;
    let users = 0;
    let groups = 0;
    let serviceAccounts = 0;
    let references = 0;

    for (const item of items || []) {
      const condition = readyCondition(item);
      if (String(condition?.status).toLowerCase() === 'true') ready += 1;
      const kind = tenantOwnerIdentity(item).kind;
      if (kind === 'User') users += 1;
      else if (kind === 'Group') groups += 1;
      else if (kind === 'ServiceAccount') serviceAccounts += 1;
      references += referencedTenantsForOwner(item, tenants).length;
    }

    const total = items?.length || 0;
    return {
      groups,
      notReady: total - ready,
      ready,
      references,
      serviceAccounts,
      total,
      users,
    };
  }, [items, tenants]);

  if (error) {
    return <Typography color="error">Unable to load TenantOwners: {error.message}</Typography>;
  }

  return (
    <>
      <SummaryCardGrid columns={3} marginBottom={2} inset>
        <StatCard
          label="TENANT OWNERS"
          total={stats.total}
          segments={[
            { name: 'Ready', value: stats.ready, color: '#4caf50' },
            { name: 'Not Ready', value: stats.notReady, color: '#f44336' },
          ]}
          chips={[
            { label: `${stats.ready} Ready`, color: 'success' },
            { label: `${stats.notReady} Not Ready`, color: 'error' },
          ]}
        />
        <StatCard
          label="IDENTITY TYPES"
          total={stats.total}
          segments={[
            { name: 'Users', value: stats.users, color: '#1976d2' },
            { name: 'Groups', value: stats.groups, color: '#7b1fa2' },
            { name: 'Service Accounts', value: stats.serviceAccounts, color: '#00897b' },
          ]}
          chips={[
            { label: `${stats.users} Users`, color: 'primary' },
            { label: `${stats.groups} Groups`, color: 'info' },
            { label: `${stats.serviceAccounts} Service Accounts`, color: 'info' },
          ]}
        />
        <StatCard
          label="TENANT REFERENCES"
          total={stats.references}
          segments={[{ name: 'References', value: stats.references, color: '#1976d2' }]}
          chips={[{ label: `${stats.references} References`, color: 'primary' }]}
        />
      </SummaryCardGrid>

      <ResourceListView
        title="Tenant Owners"
        resourceClass={TenantOwner}
        defaultSortingColumn={{ id: 'name', desc: false }}
        columns={[
          {
            id: 'name',
            label: 'Name',
            getValue: item => item.getName(),
            render: item => (
              <CapsuleResourceLink crd={CAPSULE_CRDS.TenantOwner} name={item.getName()}>
                {item.getName()}
              </CapsuleResourceLink>
            ),
          },
          {
            id: 'kind',
            label: 'Kind',
            getValue: item => tenantOwnerIdentity(item).kind,
            render: item => <Chip size="small" label={tenantOwnerIdentity(item).kind} />,
          },
          {
            id: 'identity',
            label: 'Identity',
            getValue: item => tenantOwnerIdentity(item).name,
          },
          {
            id: 'cluster-roles',
            label: 'Cluster Roles',
            getValue: item => (item.spec?.clusterRoles || []).join(' '),
            render: item => (
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {(item.spec?.clusterRoles || []).map(role => (
                  <Chip key={role} size="small" label={role} variant="outlined" />
                ))}
              </Stack>
            ),
          },
          {
            id: 'tenants',
            label: 'Tenants',
            getValue: item => referencedTenantsForOwner(item, tenants).length,
            render: item => {
              const count = referencedTenantsForOwner(item, tenants).length;
              return <Chip size="small" label={`${count} tenant${count === 1 ? '' : 's'}`} />;
            },
          },
          {
            id: 'ready',
            label: 'Ready',
            getValue: item => String(readyCondition(item)?.status || 'Unknown'),
            render: item => (
              <ConditionStatusChip status={readyCondition(item)?.status} type="Ready" />
            ),
          },
          {
            id: 'message',
            label: 'Message',
            getValue: item => readyCondition(item)?.message || readyCondition(item)?.reason || '',
          },
          'age',
        ]}
      />
    </>
  );
}

export default TenantOwnersList;
