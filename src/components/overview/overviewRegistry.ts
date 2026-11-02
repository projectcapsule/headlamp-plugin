import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import type { CollectionSpec } from './overviewClient';

export const RESOURCE_GROUPS = [
  { kind: 'Tenant', label: 'Tenants', icon: 'mdi:account-group-outline', category: 'Tenancy' },
  {
    kind: 'TenantOwner',
    label: 'Tenant Owners',
    icon: 'mdi:account-key-outline',
    category: 'Tenancy',
  },
  {
    kind: 'GlobalResourceQuota',
    label: 'Global Resource Quotas',
    icon: 'mdi:chart-box-outline',
    category: 'Quotas',
  },
  {
    kind: 'ResourcePool',
    label: 'Resource Pools',
    icon: 'mdi:database-outline',
    category: 'Quotas',
  },
  {
    kind: 'ResourcePoolClaim',
    label: 'Resource Pool Claims',
    icon: 'mdi:database-arrow-down-outline',
    category: 'Quotas',
    namespaced: true,
  },
  {
    kind: 'GlobalCustomQuota',
    label: 'Global Custom Quotas',
    icon: 'mdi:gauge',
    category: 'Quotas',
  },
  {
    kind: 'CustomQuota',
    label: 'Custom Quotas',
    icon: 'mdi:gauge',
    category: 'Quotas',
    namespaced: true,
  },
  {
    kind: 'GlobalTenantResource',
    label: 'Global Tenant Resources',
    icon: 'mdi:content-copy',
    category: 'Replications',
  },
  {
    kind: 'TenantResource',
    label: 'Tenant Resources',
    icon: 'mdi:content-copy',
    category: 'Replications',
    namespaced: true,
  },
  {
    kind: 'GlobalProxySettings',
    label: 'Global Proxy Settings',
    icon: 'mdi:shield-account-outline',
    category: 'Proxy & settings',
  },
  {
    kind: 'CapsuleConfiguration',
    label: 'Capsule Configurations',
    icon: 'mdi:tune-variant',
    category: 'Proxy & settings',
  },
].map(group => ({
  ...group,
  id: group.kind,
  crd: CAPSULE_CRDS[group.kind as keyof typeof CAPSULE_CRDS],
}));

export const COLLECTIONS: CollectionSpec[] = [
  ...RESOURCE_GROUPS.map(group => ({
    id: group.id,
    kind: group.kind,
    plural: group.crd.split('.')[0],
    namespaced: !!group.namespaced,
    versions: [
      group.kind === 'GlobalProxySettings'
        ? 'capsule.clastix.io/v1beta1'
        : 'capsule.clastix.io/v1beta2',
    ],
  })),
  {
    id: 'controllers',
    kind: 'Deployment',
    plural: 'deployments',
    versions: ['apps/v1'],
    namespaced: true,
    labelSelector: 'app.kubernetes.io/name in (capsule,capsule-proxy)',
  },
  { id: 'events', kind: 'Event', plural: 'events', versions: ['v1'], namespaced: true },
];
