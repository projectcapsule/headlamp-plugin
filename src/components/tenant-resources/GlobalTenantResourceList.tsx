import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Chip, Typography } from '@mui/material';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import {
  getAppliedCount,
  getResourceCondition,
  getSpecResourcesCount,
  GlobalTenantResource,
} from '../../resources/tenantResources';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import {
  GlobalTenantResourceCordonAction,
  GlobalTenantResourceReconcileAction,
} from '../common/ReconcileActions';
import { ReplicationDependenciesCell } from '../common/ReplicationDependencies';
import { TenantResourcesStats } from '../common/TenantResourcesStats';

export function GlobalTenantResourcesList() {
  const [items] = GlobalTenantResource.useList();

  return (
    <>
      <TenantResourcesStats items={items || []} scope="global" />
      <ResourceListView
        title="Global Tenant Resources"
        resourceClass={GlobalTenantResource}
        enableRowActions
        actions={[
          {
            id: 'cordon-global-tenant-resource',
            action: ({ item, closeMenu }: any) => (
              <GlobalTenantResourceCordonAction
                item={item}
                closeMenu={closeMenu}
                buttonStyle="menu"
              />
            ),
          },
          {
            id: 'force-reconcile',
            action: ({ item, closeMenu }: any) => (
              <GlobalTenantResourceReconcileAction
                item={item}
                closeMenu={closeMenu}
                buttonStyle="menu"
              />
            ),
          },
        ]}
        columns={[
          {
            id: 'name',
            label: 'Name',
            getValue: item => item.getName(),
            render: item => (
              <CapsuleResourceLink crd={CAPSULE_CRDS.GlobalTenantResource} name={item.getName()}>
                {item.getName()}
              </CapsuleResourceLink>
            ),
          },
          {
            id: 'dependencies',
            label: 'Depends On',
            getValue: item =>
              (item.spec?.dependsOn || item.jsonData?.spec?.dependsOn || [])
                .map((dependency: any) => dependency.name)
                .join(' '),
            render: item => <ReplicationDependenciesCell item={item} candidates={items || []} />,
          },
          {
            id: 'resources',
            label: 'Resources',
            getValue: item => getSpecResourcesCount(item),
            render: item => {
              const count = getSpecResourcesCount(item);
              return <Chip size="small" label={`${count} resource${count === 1 ? '' : 's'}`} />;
            },
          },
          {
            id: 'statusResources',
            label: 'Replicated',
            getValue: item => getAppliedCount(item),
            render: item => {
              const count = getAppliedCount(item);
              return <Chip size="small" label={`${count} object${count === 1 ? '' : 's'}`} />;
            },
          },
          {
            id: 'ready',
            label: 'Ready',
            getValue: item => String(getResourceCondition(item, 'Ready')?.status ?? 'Unknown'),
            render: item => (
              <ConditionStatusChip status={getResourceCondition(item, 'Ready')?.status} />
            ),
          },
          {
            id: 'message',
            label: 'Message',
            getValue: item => {
              const condition = getResourceCondition(item, 'Ready');
              return condition?.message || condition?.reason || '';
            },
            render: item => {
              const condition = getResourceCondition(item, 'Ready');
              return (
                <Typography
                  variant="body2"
                  color={
                    String(condition?.status).toLowerCase() === 'false'
                      ? 'error.main'
                      : 'text.secondary'
                  }
                  sx={{ maxWidth: 420, minWidth: 180, whiteSpace: 'normal' }}
                >
                  {condition?.message || condition?.reason || '—'}
                </Typography>
              );
            },
          },
          'age',
        ]}
      />
    </>
  );
}
