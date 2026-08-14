import { Typography } from '@mui/material';
import { useMemo } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { CustomQuota, GlobalCustomQuota } from '../../resources/customQuotas';
import { GlobalResourceQuota } from '../../resources/globalResourceQuotas';
import { ResourcePool } from '../../resources/resourcePools';
import { TenantOwner } from '../../resources/tenantOwners';
import {
  getAppliedObjectsForTable,
  getManagedObjectReadyStatus,
  GlobalTenantResource,
  TenantResource,
} from '../../resources/tenantResources';
import { Tenants } from '../../resources/tenants';
import { getTenantSpaces, isSpaceReady } from '../../utils/tenantSpaces';
import { useFetchedResources } from '../common/ManagedResources';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import { CapsuleEvents } from './CapsuleEvents';
import { countQuotaHealth, countReadiness, countResourcePools } from './overviewStats';

const footer = (text: string) => (
  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.25 }}>
    {text}
  </Typography>
);

export function CapsuleOverview() {
  const [tenants] = Tenants.useList();
  const [customQuotas] = CustomQuota.useList();
  const [globalCustomQuotas] = GlobalCustomQuota.useList();
  const [globalResourceQuotas] = GlobalResourceQuota.useList();
  const [tenantResources] = TenantResource.useList();
  const [globalTenantResources] = GlobalTenantResource.useList();
  const [resourcePools] = ResourcePool.useList();
  const [tenantOwners] = TenantOwner.useList();

  const allManagedApplied = useMemo(() => {
    const fromGlobal = (globalTenantResources || []).flatMap(resource =>
      getAppliedObjectsForTable(resource)
    );
    const fromTenant = (tenantResources || []).flatMap(resource =>
      getAppliedObjectsForTable(resource)
    );
    return [...fromGlobal, ...fromTenant];
  }, [globalTenantResources, tenantResources]);

  const managedObjects = useFetchedResources(allManagedApplied);

  const stats = useMemo(() => {
    let activeTenants = 0;
    let cordonedTenants = 0;
    let readyNamespaces = 0;
    let notReadyNamespaces = 0;

    (tenants || []).forEach(tenant => {
      const state = tenant.status?.state || tenant.jsonData?.status?.state || '';
      const isCordoned = !!tenant.jsonData?.spec?.cordoned || state.toLowerCase() === 'cordoned';
      if (isCordoned) cordonedTenants++;
      else activeTenants++;

      getTenantSpaces(tenant).forEach(space => {
        if (isSpaceReady(space)) readyNamespaces++;
        else notReadyNamespaces++;
      });
    });

    const customQuotaHealth = countQuotaHealth(customQuotas);
    const globalCustomQuotaHealth = countQuotaHealth(globalCustomQuotas);
    const globalResourceQuotaReadiness = countReadiness(globalResourceQuotas);
    const globalResourceQuotaNamespaces = (globalResourceQuotas || []).reduce(
      (total, quota) => total + (Number(quota.status?.namespaceCount) || 0),
      0
    );
    const tenantResourceReadiness = countReadiness(tenantResources);
    const globalTenantResourceReadiness = countReadiness(globalTenantResources);
    const tenantOwnerReadiness = countReadiness(tenantOwners);
    const resourcePoolState = countResourcePools(resourcePools);

    let managedReady = 0;
    let managedNotReady = 0;
    let managedUnknown = 0;
    (managedObjects || []).forEach(object => {
      if (!object?.metadata?.creationTimestamp) {
        managedUnknown++;
        return;
      }

      const status = getManagedObjectReadyStatus(object, allManagedApplied);
      if (status.color === 'success' || status.label.toLowerCase() === 'true') {
        managedReady++;
      } else if (status.color === 'error') {
        managedNotReady++;
      } else {
        managedUnknown++;
      }
    });

    return {
      tenants: {
        active: activeTenants,
        cordoned: cordonedTenants,
        total: tenants?.length || 0,
      },
      namespaces: {
        ready: readyNamespaces,
        notReady: notReadyNamespaces,
        total: readyNamespaces + notReadyNamespaces,
      },
      customQuotaHealth,
      globalCustomQuotaHealth,
      globalResourceQuotaState: {
        ...globalResourceQuotaReadiness,
        namespaces: globalResourceQuotaNamespaces,
      },
      tenantResourceReadiness,
      globalTenantResourceReadiness,
      tenantOwnerReadiness,
      resourcePoolState,
      managed: {
        ready: managedReady,
        notReady: managedNotReady,
        unknown: managedUnknown,
        total: managedObjects?.length || 0,
      },
    };
  }, [
    tenants,
    customQuotas,
    globalCustomQuotas,
    globalResourceQuotas,
    tenantResources,
    globalTenantResources,
    tenantOwners,
    resourcePools,
    managedObjects,
    allManagedApplied,
  ]);

  return (
    <>
      <Typography variant="h4" sx={{ mb: 1 }}>
        Capsule
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Overview of your Capsule multi-tenancy installation. Use the tenant selector in the top bar
        to scope the UI.
      </Typography>

      <SummaryCardGrid title="Tenant" columns={3}>
        <StatCard
          label="TENANTS"
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.Tenant }}
          total={stats.tenants.total}
          fullHeight
          segments={[
            { name: 'Active', value: stats.tenants.active, color: '#4caf50' },
            { name: 'Cordoned', value: stats.tenants.cordoned, color: '#ff9800' },
          ]}
          chips={[
            { label: `${stats.tenants.active} Active`, color: 'success' },
            { label: `${stats.tenants.cordoned} Cordoned`, color: 'warning' },
          ]}
          footer={footer('Cluster-scoped tenants')}
        />

        <StatCard
          label="MANAGED NAMESPACES"
          routeName="namespaces"
          total={stats.namespaces.total}
          fullHeight
          segments={[
            { name: 'Ready', value: stats.namespaces.ready, color: '#4caf50' },
            { name: 'Not Ready', value: stats.namespaces.notReady, color: '#f44336' },
          ]}
          chips={[
            { label: `${stats.namespaces.ready} Ready`, color: 'success' },
            { label: `${stats.namespaces.notReady} Not Ready`, color: 'error' },
          ]}
          footer={footer('Across all tenants')}
        />

        <StatCard
          label="TENANT OWNERS"
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.TenantOwner }}
          total={stats.tenantOwnerReadiness.total}
          fullHeight
          segments={[
            { name: 'Ready', value: stats.tenantOwnerReadiness.ready, color: '#4caf50' },
            {
              name: 'Not Ready',
              value: stats.tenantOwnerReadiness.notReady,
              color: '#f44336',
            },
          ]}
          chips={[
            { label: `${stats.tenantOwnerReadiness.ready} Ready`, color: 'success' },
            { label: `${stats.tenantOwnerReadiness.notReady} Not Ready`, color: 'error' },
          ]}
          footer={footer('Users, groups, and service accounts')}
        />
      </SummaryCardGrid>

      <SummaryCardGrid title="Quotas" columns={4}>
        <StatCard
          label="RESOURCE POOLS"
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.ResourcePool }}
          total={stats.resourcePoolState.total}
          fullHeight
          segments={[
            { name: 'Ready', value: stats.resourcePoolState.ready, color: '#4caf50' },
            {
              name: 'Not Ready',
              value: stats.resourcePoolState.notReady,
              color: '#f44336',
            },
          ]}
          chips={[
            { label: `${stats.resourcePoolState.ready} Ready`, color: 'success' },
            { label: `${stats.resourcePoolState.notReady} Not Ready`, color: 'error' },
          ]}
          footer={footer(
            `${stats.resourcePoolState.claims} Claims · ${stats.resourcePoolState.exhausted} Exhausted`
          )}
        />

        <StatCard
          label="CUSTOM QUOTAS"
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.CustomQuota }}
          total={stats.customQuotaHealth.total}
          fullHeight
          segments={[
            { name: 'Healthy', value: stats.customQuotaHealth.healthy, color: '#4caf50' },
            { name: 'Warning', value: stats.customQuotaHealth.warning, color: '#ff9800' },
            { name: 'Critical', value: stats.customQuotaHealth.critical, color: '#f44336' },
          ]}
          chips={[
            { label: `${stats.customQuotaHealth.healthy} Healthy`, color: 'success' },
            { label: `${stats.customQuotaHealth.warning} Warning`, color: 'warning' },
            { label: `${stats.customQuotaHealth.critical} Critical`, color: 'error' },
          ]}
          footer={footer('Namespaced quota usage')}
        />

        <StatCard
          label="GLOBAL CUSTOM QUOTAS"
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.GlobalCustomQuota }}
          total={stats.globalCustomQuotaHealth.total}
          fullHeight
          segments={[
            { name: 'Healthy', value: stats.globalCustomQuotaHealth.healthy, color: '#4caf50' },
            { name: 'Warning', value: stats.globalCustomQuotaHealth.warning, color: '#ff9800' },
            { name: 'Critical', value: stats.globalCustomQuotaHealth.critical, color: '#f44336' },
          ]}
          chips={[
            { label: `${stats.globalCustomQuotaHealth.healthy} Healthy`, color: 'success' },
            { label: `${stats.globalCustomQuotaHealth.warning} Warning`, color: 'warning' },
            { label: `${stats.globalCustomQuotaHealth.critical} Critical`, color: 'error' },
          ]}
          footer={footer('Cluster-wide quota usage')}
        />

        <StatCard
          label="GLOBAL RESOURCE QUOTAS"
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.GlobalResourceQuota }}
          total={stats.globalResourceQuotaState.total}
          segments={[
            { name: 'Ready', value: stats.globalResourceQuotaState.ready, color: '#4caf50' },
            {
              name: 'Not Ready',
              value: stats.globalResourceQuotaState.notReady,
              color: '#f44336',
            },
          ]}
          chips={[
            { label: `${stats.globalResourceQuotaState.ready} Ready`, color: 'success' },
            {
              label: `${stats.globalResourceQuotaState.notReady} Not Ready`,
              color: 'error',
            },
          ]}
          footer={footer(`${stats.globalResourceQuotaState.namespaces} Namespaces in scope`)}
        />
      </SummaryCardGrid>

      <SummaryCardGrid title="Replications" columns={3}>
        <StatCard
          label="TENANT RESOURCES"
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.TenantResource }}
          total={stats.tenantResourceReadiness.total}
          fullHeight
          segments={[
            { name: 'Ready', value: stats.tenantResourceReadiness.ready, color: '#4caf50' },
            {
              name: 'Not Ready',
              value: stats.tenantResourceReadiness.notReady,
              color: '#f44336',
            },
          ]}
          chips={[
            { label: `${stats.tenantResourceReadiness.ready} Ready`, color: 'success' },
            { label: `${stats.tenantResourceReadiness.notReady} Not Ready`, color: 'error' },
          ]}
          footer={footer('Namespaced replication rules')}
        />

        <StatCard
          label="GLOBAL TENANT RESOURCES"
          routeName="customresources"
          routeParams={{ crd: CAPSULE_CRDS.GlobalTenantResource }}
          total={stats.globalTenantResourceReadiness.total}
          fullHeight
          segments={[
            {
              name: 'Ready',
              value: stats.globalTenantResourceReadiness.ready,
              color: '#4caf50',
            },
            {
              name: 'Not Ready',
              value: stats.globalTenantResourceReadiness.notReady,
              color: '#f44336',
            },
          ]}
          chips={[
            { label: `${stats.globalTenantResourceReadiness.ready} Ready`, color: 'success' },
            {
              label: `${stats.globalTenantResourceReadiness.notReady} Not Ready`,
              color: 'error',
            },
          ]}
          footer={footer('Cluster-scoped replication rules')}
        />

        <StatCard
          label="MANAGED RESOURCES"
          routeName="map"
          routeSearch={{ group: 'tenant', show: 'all' }}
          total={stats.managed.total}
          fullHeight
          segments={[
            { name: 'Ready', value: stats.managed.ready, color: '#4caf50' },
            { name: 'Not Ready', value: stats.managed.notReady, color: '#f44336' },
            { name: 'Unknown', value: stats.managed.unknown, color: '#9e9e9e' },
          ]}
          chips={[
            { label: `${stats.managed.ready} Ready`, color: 'success' },
            { label: `${stats.managed.notReady} Not Ready`, color: 'error' },
            ...(stats.managed.unknown > 0
              ? [{ label: `${stats.managed.unknown} Unknown`, color: 'default' as const }]
              : []),
          ]}
          footer={footer('Replicated objects')}
        />
      </SummaryCardGrid>

      <CapsuleEvents />
    </>
  );
}
