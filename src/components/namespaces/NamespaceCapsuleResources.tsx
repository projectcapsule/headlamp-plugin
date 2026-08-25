import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Chip, Typography } from '@mui/material';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { CustomQuota } from '../../resources/customQuotas';
import {
  getAppliedCount,
  getResourceCondition,
  getSpecResourcesCount,
  TenantResource,
} from '../../resources/tenantResources';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionStatusChip } from '../common/ConditionStatusChip';
import { QuotaUsage } from '../common/QuotaUsage';
import { ReplicationDependenciesCell } from '../common/ReplicationDependencies';
import { anchoredResourceListHeaderProps } from '../common/SectionAnchor';

function namespaceIdentity(namespace: any) {
  return {
    cluster: namespace?.cluster,
    name:
      namespace?.getName?.() || namespace?.metadata?.name || namespace?.jsonData?.metadata?.name,
  };
}

export function NamespaceCustomQuotas({ namespace }: { namespace: any }) {
  const identity = namespaceIdentity(namespace);
  const [items, error] = CustomQuota.useList({
    cluster: identity.cluster,
    namespace: identity.name,
  });

  return (
    <ResourceListView
      id="capsule-namespace-customquotas"
      title="Custom Quotas"
      data={items}
      headerProps={anchoredResourceListHeaderProps('Custom Quotas')}
      errorMessage={CustomQuota.getErrorMessage(error)}
      defaultSortingColumn={{ id: 'name', desc: false }}
      reflectInURL={false}
      columns={[
        {
          id: 'name',
          label: 'Name',
          getValue: item => item.getName(),
          render: item => (
            <CapsuleResourceLink
              crd={CAPSULE_CRDS.CustomQuota}
              name={item.getName()}
              namespace={item.getNamespace()}
            >
              {item.getName()}
            </CapsuleResourceLink>
          ),
        },
        {
          id: 'limit',
          label: 'Limit',
          getValue: item => item.spec?.limit || '',
        },
        {
          id: 'used',
          label: 'Used',
          getValue: item => item.status?.usage?.used || '0',
          render: item => (
            <QuotaUsage used={item.status?.usage?.used} limit={item.spec?.limit} size={18} />
          ),
        },
        {
          id: 'available',
          label: 'Available',
          getValue: item => item.status?.usage?.available || '',
        },
        {
          id: 'sources',
          label: 'Sources',
          getValue: item => (item.spec?.sources || []).length,
          render: item => {
            const count = (item.spec?.sources || []).length;
            return <Chip size="small" label={`${count} source${count === 1 ? '' : 's'}`} />;
          },
        },
        'age',
      ]}
    />
  );
}

export function NamespaceTenantResources({ namespace }: { namespace: any }) {
  const identity = namespaceIdentity(namespace);
  const [items, error] = TenantResource.useList({
    cluster: identity.cluster,
    namespace: identity.name,
  });

  return (
    <ResourceListView
      id="capsule-namespace-tenantresources"
      title="Tenant Resources"
      data={items}
      headerProps={anchoredResourceListHeaderProps('Tenant Resources')}
      errorMessage={TenantResource.getErrorMessage(error)}
      defaultSortingColumn={{ id: 'name', desc: false }}
      reflectInURL={false}
      columns={[
        {
          id: 'name',
          label: 'Name',
          getValue: item => item.getName(),
          render: item => (
            <CapsuleResourceLink
              crd={CAPSULE_CRDS.TenantResource}
              name={item.getName()}
              namespace={item.getNamespace()}
            >
              {item.getName()}
            </CapsuleResourceLink>
          ),
        },
        {
          id: 'dependencies',
          label: 'Depends On',
          getValue: item =>
            (item.spec?.dependsOn || []).map(dependency => dependency.name).join(' '),
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
          id: 'replicated',
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
  );
}
