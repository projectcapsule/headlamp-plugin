import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { useMemo } from 'react';
import { CustomQuota, GlobalCustomQuota } from '../../resources/customQuotas';
import { GlobalResourceQuota } from '../../resources/globalResourceQuotas';
import { ResourcePool } from '../../resources/resourcePools';
import { TenantOwner } from '../../resources/tenantOwners';
import { GlobalTenantResource, TenantResource } from '../../resources/tenantResources';
import { Tenants } from '../../resources/tenants';
import type { MapSourceDefinition } from './mapTypes';

function source(
  id: string,
  label: string,
  category: MapSourceDefinition['category'],
  icon: string,
  items: any[] | null,
  enabledByDefault: boolean
): MapSourceDefinition {
  return { id, label, category, icon, items, enabledByDefault };
}

/** All statically-declared resource hooks used by the Capsule map. */
export function useMapSources(): MapSourceDefinition[] {
  const [pods] = K8s.ResourceClasses.Pod.useList();
  const [deployments] = K8s.ResourceClasses.Deployment.useList();
  const [statefulSets] = K8s.ResourceClasses.StatefulSet.useList();
  const [daemonSets] = K8s.ResourceClasses.DaemonSet.useList();
  const [replicaSets] = K8s.ResourceClasses.ReplicaSet.useList();
  const [jobs] = K8s.ResourceClasses.Job.useList();
  const [cronJobs] = K8s.ResourceClasses.CronJob.useList();

  const [persistentVolumeClaims] = K8s.ResourceClasses.PersistentVolumeClaim.useList();

  const [services] = K8s.ResourceClasses.Service.useList();
  const [endpoints] = K8s.ResourceClasses.Endpoints.useList();
  const [ingresses] = K8s.ResourceClasses.Ingress.useList();
  const [networkPolicies] = K8s.ResourceClasses.NetworkPolicy.useList();

  const [serviceAccounts] = K8s.ResourceClasses.ServiceAccount.useList();
  const [roles] = K8s.ResourceClasses.Role.useList();
  const [roleBindings] = K8s.ResourceClasses.RoleBinding.useList();

  const [configMaps] = K8s.ResourceClasses.ConfigMap.useList();
  const [secrets] = K8s.ResourceClasses.Secret.useList();
  const [horizontalPodAutoscalers] = K8s.ResourceClasses.HorizontalPodAutoscaler.useList();
  const [podDisruptionBudgets] = K8s.ResourceClasses.PodDisruptionBudget.useList();
  const [resourceQuotas] = K8s.ResourceClasses.ResourceQuota.useList();
  const [limitRanges] = K8s.ResourceClasses.LimitRange.useList();

  const [tenants] = Tenants.useList();
  const [tenantOwners] = TenantOwner.useList();
  const [resourcePools] = ResourcePool.useList();
  const [globalResourceQuotas] = GlobalResourceQuota.useList();
  const [customQuotas] = CustomQuota.useList();
  const [globalCustomQuotas] = GlobalCustomQuota.useList();
  const [tenantResources] = TenantResource.useList();
  const [globalTenantResources] = GlobalTenantResource.useList();

  return useMemo(
    () => [
      source('pods', 'Pods', 'Workloads', 'mdi:cube-outline', pods, true),
      source('deployments', 'Deployments', 'Workloads', 'mdi:rocket-launch', deployments, true),
      source('statefulsets', 'Stateful Sets', 'Workloads', 'mdi:database-sync', statefulSets, true),
      source('daemonsets', 'Daemon Sets', 'Workloads', 'mdi:server-network', daemonSets, true),
      source('replicasets', 'Replica Sets', 'Workloads', 'mdi:content-copy', replicaSets, true),
      source('jobs', 'Jobs', 'Workloads', 'mdi:briefcase-check', jobs, true),
      source('cronjobs', 'Cron Jobs', 'Workloads', 'mdi:calendar-clock', cronJobs, true),

      source(
        'persistentvolumeclaims',
        'Persistent Volume Claims',
        'Storage',
        'mdi:database',
        persistentVolumeClaims,
        true
      ),

      source('services', 'Services', 'Network', 'mdi:lan-connect', services, true),
      source('endpoints', 'Endpoints', 'Network', 'mdi:connection', endpoints, true),
      source('ingresses', 'Ingresses', 'Network', 'mdi:call-split', ingresses, true),
      source(
        'networkpolicies',
        'Network Policies',
        'Network',
        'mdi:shield-network',
        networkPolicies,
        true
      ),

      source(
        'serviceaccounts',
        'Service Accounts',
        'Security',
        'mdi:account-cog',
        serviceAccounts,
        false
      ),
      source('roles', 'Roles', 'Security', 'mdi:shield-account', roles, false),
      source('rolebindings', 'Role Bindings', 'Security', 'mdi:account-lock', roleBindings, false),

      source('configmaps', 'Config Maps', 'Configuration', 'mdi:file-cog', configMaps, false),
      source('secrets', 'Secrets', 'Configuration', 'mdi:key-variant', secrets, false),
      source(
        'horizontalpodautoscalers',
        'Horizontal Pod Autoscalers',
        'Configuration',
        'mdi:arrow-expand-horizontal',
        horizontalPodAutoscalers,
        false
      ),
      source(
        'poddisruptionbudgets',
        'Pod Disruption Budgets',
        'Configuration',
        'mdi:shield-check',
        podDisruptionBudgets,
        false
      ),
      source(
        'resourcequotas',
        'Resource Quotas',
        'Configuration',
        'mdi:gauge',
        resourceQuotas,
        false
      ),
      source('limitranges', 'Limit Ranges', 'Configuration', 'mdi:tune', limitRanges, false),

      source('tenants', 'Tenants', 'Tenant', 'mdi:account-group', tenants, false),
      source('tenantowners', 'Tenant Owners', 'Tenant', 'mdi:account-key', tenantOwners, false),
      source('resourcepools', 'Resource Pools', 'Tenant', 'mdi:pool', resourcePools, false),
      source(
        'globalresourcequotas',
        'Global Resource Quotas',
        'Tenant',
        'mdi:gauge',
        globalResourceQuotas,
        false
      ),
      source('customquotas', 'Custom Quotas', 'Tenant', 'mdi:chart-pie', customQuotas, false),
      source(
        'globalcustomquotas',
        'Global Custom Quotas',
        'Tenant',
        'mdi:chart-bar-stacked',
        globalCustomQuotas,
        false
      ),
      source(
        'tenantresources',
        'Tenant Resources',
        'Tenant',
        'mdi:file-document',
        tenantResources,
        false
      ),
      source(
        'globaltenantresources',
        'Global Tenant Resources',
        'Tenant',
        'mdi:file-document-multiple',
        globalTenantResources,
        false
      ),
    ],
    [
      pods,
      deployments,
      statefulSets,
      daemonSets,
      replicaSets,
      jobs,
      cronJobs,
      persistentVolumeClaims,
      services,
      endpoints,
      ingresses,
      networkPolicies,
      serviceAccounts,
      roles,
      roleBindings,
      configMaps,
      secrets,
      horizontalPodAutoscalers,
      podDisruptionBudgets,
      resourceQuotas,
      limitRanges,
      tenants,
      tenantOwners,
      resourcePools,
      globalResourceQuotas,
      customQuotas,
      globalCustomQuotas,
      tenantResources,
      globalTenantResources,
    ]
  );
}
