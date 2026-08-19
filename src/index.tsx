import {
  registerAppBarAction,
  registerDetailsViewHeaderAction,
  registerDetailsViewHeaderActionsProcessor,
  registerDetailsViewSectionsProcessor,
  registerPluginSettings,
  registerResourceTableColumnsProcessor,
  registerRoute,
  registerSidebarEntry,
  registerUIPanel,
} from '@kinvolk/headlamp-plugin/lib';
import { RESOURCE_DEFINITIONS } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  CapsuleCustomResourceDetail,
  type CapsuleCustomResourceDetailKind,
  CapsuleCustomResourceList,
} from './components/common/CapsuleCustomResourceDetail';
import {
  CAPSULE_DOCUMENTATION_ACTION_ID,
  insertDocumentationAction,
} from './components/common/capsuleDocumentation';
import { CapsuleDocumentationAction } from './components/common/CapsuleDocumentationAction';
import { CAPSULE_ICONIFY_ICON } from './components/common/CapsuleIcon';
import { prewarmCapsuleTableEditAuthorization } from './components/common/CapsuleTableEditAuthorization';
import {
  GlobalTenantResourceCordonAction,
  GlobalTenantResourceReconcileAction,
  NamespaceCordonAction,
  TenantCordonAction,
  TenantResourceCordonAction,
  TenantResourceReconcileAction,
} from './components/common/ReconcileActions';
import { CapsuleConfigurationDetail } from './components/configuration/CapsuleConfigurationDetail';
import { CapsuleConfigurationList } from './components/configuration/CapsuleConfigurationList';
import { CapsuleMap } from './components/map/CapsuleMap';
import { processNamespaceDetailsSections } from './components/namespaces/NamespaceDetailsIntegration';
import { CapsuleOverview } from './components/overview/CapsuleOverview';
import { GlobalProxySettingsDetail } from './components/proxy/GlobalProxySettingsDetail';
import { GlobalProxySettingsList } from './components/proxy/GlobalProxySettingsList';
import CreateCustomQuotaForm from './components/quotas/CreateCustomQuotaForm';
import CreateGlobalCustomQuotaForm from './components/quotas/CreateGlobalCustomQuotaForm';
import { CustomQuotaDetail } from './components/quotas/CustomQuotaDetail';
import { CustomQuotasList } from './components/quotas/CustomQuotaList';
import { GlobalCustomQuotaDetail } from './components/quotas/GlobalCustomQuotaDetail';
import { GlobalCustomQuotasList } from './components/quotas/GlobalCustomQuotaList';
import { GlobalResourceQuotaDetail } from './components/quotas/GlobalResourceQuotaDetail';
import { GlobalResourceQuotasList } from './components/quotas/GlobalResourceQuotaList';
import { ResourcePoolClaimDetail } from './components/quotas/ResourcePoolClaimDetail';
import { ResourcePoolDetail } from './components/quotas/ResourcePoolDetail';
import { ResourcePoolsList } from './components/quotas/ResourcePoolList';
import { CapsuleSettings } from './components/settings/CapsuleSettings';
import { processPersistentVolumeDetailsSections } from './components/storage/PersistentVolumeTenantIntegration';
import { TenantOwnerDetail } from './components/tenant-owners/TenantOwnerDetail';
import { TenantOwnersList } from './components/tenant-owners/TenantOwnerList';
import CreateGlobalTenantResourceForm from './components/tenant-resources/CreateGlobalTenantResourceForm';
import CreateTenantResourceForm from './components/tenant-resources/CreateTenantResourceForm';
import { GlobalTenantResourceDetail } from './components/tenant-resources/GlobalTenantResourceDetail';
import { GlobalTenantResourcesList } from './components/tenant-resources/GlobalTenantResourceList';
import { TenantResourceDetail } from './components/tenant-resources/TenantResourceDetail';
import { TenantResourcesList } from './components/tenant-resources/TenantResourceList';
import CreateTenantForm from './components/tenants/CreateTenantForm';
import { ServiceAccountPromotionAction } from './components/tenants/ServiceAccountPromotionAction';
import { TenantBox } from './components/tenants/TenantBox';
import { TenantDetail } from './components/tenants/TenantDetail';
import { TenantLinksBar } from './components/tenants/TenantLinksBar';
import { TenantsList } from './components/tenants/TenantList';
import { CapsuleConfiguration } from './resources/capsuleConfigurations';
import {
  CAPSULE_CRDS,
  capsuleCustomResourceDetailPath,
  capsuleCustomResourceListPath,
} from './resources/capsuleCustomResources';
import { CustomQuota, GlobalCustomQuota } from './resources/customQuotas';
import { GlobalProxySettings } from './resources/globalProxySettings';
import { GlobalResourceQuota } from './resources/globalResourceQuotas';
import { ResourcePool, ResourcePoolClaim } from './resources/resourcePools';
import { TenantOwner } from './resources/tenantOwners';
import { GlobalTenantResource, TenantResource } from './resources/tenantResources';
import { Tenants } from './resources/tenants';

registerAppBarAction(<TenantBox />);
registerUIPanel({
  id: 'capsule-tenant-contexts',
  side: 'top',
  component: () => <TenantLinksBar />,
});
registerPluginSettings('capsule', CapsuleSettings, true);
registerResourceTableColumnsProcessor(prewarmCapsuleTableEditAuthorization);

// Make the plugin's rich detail pages canonical for Capsule CR instances opened
// from Headlamp's Custom Resources lists, search results, or direct URLs. These
// literal routes are evaluated before Headlamp's generic :crd renderer; other
// CRDs are untouched and continue to use the default page.
const capsuleCustomResourceDetails: Array<{
  crd: string;
  kind: CapsuleCustomResourceDetailKind;
  sidebar: string;
}> = [
  {
    crd: CAPSULE_CRDS.CapsuleConfiguration,
    kind: 'CapsuleConfiguration',
    sidebar: 'capsule-configurations',
  },
  { crd: CAPSULE_CRDS.Tenant, kind: 'Tenant', sidebar: 'tenants' },
  { crd: CAPSULE_CRDS.TenantOwner, kind: 'TenantOwner', sidebar: 'tenant-owners' },
  { crd: CAPSULE_CRDS.CustomQuota, kind: 'CustomQuota', sidebar: 'custom-quotas' },
  {
    crd: CAPSULE_CRDS.GlobalCustomQuota,
    kind: 'GlobalCustomQuota',
    sidebar: 'global-custom-quotas',
  },
  {
    crd: CAPSULE_CRDS.GlobalResourceQuota,
    kind: 'GlobalResourceQuota',
    sidebar: 'global-resource-quotas',
  },
  {
    crd: CAPSULE_CRDS.GlobalProxySettings,
    kind: 'GlobalProxySettings',
    sidebar: 'global-proxy-settings',
  },
  { crd: CAPSULE_CRDS.ResourcePool, kind: 'ResourcePool', sidebar: 'resource-pools' },
  {
    crd: CAPSULE_CRDS.TenantResource,
    kind: 'TenantResource',
    sidebar: 'tenant-resources',
  },
  {
    crd: CAPSULE_CRDS.GlobalTenantResource,
    kind: 'GlobalTenantResource',
    sidebar: 'global-tenant-resources',
  },
];

capsuleCustomResourceDetails.forEach(({ crd, kind, sidebar }) => {
  registerRoute({
    path: capsuleCustomResourceListPath(crd),
    exact: true,
    name: `capsule-${kind.toLowerCase()}-customresources`,
    sidebar,
    component: () => <CapsuleCustomResourceList kind={kind} />,
  });
  registerRoute({
    path: capsuleCustomResourceDetailPath(crd),
    exact: true,
    name: `capsule-${kind.toLowerCase()}-customresource`,
    sidebar,
    component: () => <CapsuleCustomResourceDetail kind={kind} />,
  });
});

registerRoute({
  path: capsuleCustomResourceDetailPath(CAPSULE_CRDS.ResourcePoolClaim),
  exact: true,
  name: 'capsule-resourcepoolclaim-customresource',
  sidebar: 'resource-pools',
  component: () => <ResourcePoolClaimDetail />,
});

// Plugin routes are evaluated before Headlamp defaults. The map uses only
// supported plugin APIs and bundles React Flow; private Headlamp map modules are
// intentionally avoided because they are not exposed in the browser plugin API.
registerRoute({
  path: '/map',
  exact: true,
  name: 'Map',
  sidebar: 'map',
  isFullWidth: true,
  component: () => <CapsuleMap height="100%" />,
});

registerSidebarEntry({
  parent: '',
  name: 'capsule',
  label: 'Capsule',
  icon: CAPSULE_ICONIFY_ICON,
  url: '/capsule/overview/',
});

registerSidebarEntry({
  parent: 'capsule',
  name: 'overview',
  label: 'Overview',
  icon: 'mdi:view-dashboard',
  url: '/capsule/overview/',
});

registerSidebarEntry({
  parent: 'capsule',
  name: 'capsule-tenant-section',
  label: 'Tenant',
  icon: 'mdi:account-multiple-outline',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.Tenant),
});

registerSidebarEntry({
  parent: 'capsule-tenant-section',
  name: 'tenants',
  label: 'Tenants',
  icon: 'mdi:account-group',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.Tenant),
});

registerSidebarEntry({
  parent: 'capsule-tenant-section',
  name: 'tenant-owners',
  label: 'Tenant Owners',
  icon: 'mdi:account-key',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.TenantOwner),
});

registerSidebarEntry({
  parent: 'capsule',
  name: 'capsule-quotas-section',
  label: 'Quotas',
  icon: 'mdi:chart-donut',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.GlobalResourceQuota),
});

registerSidebarEntry({
  parent: 'capsule-quotas-section',
  name: 'global-resource-quotas',
  label: 'Global Resource Quotas',
  icon: 'mdi:gauge',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.GlobalResourceQuota),
});

registerSidebarEntry({
  parent: 'capsule-quotas-section',
  name: 'resource-pools',
  label: 'Resource Pools',
  icon: 'mdi:pool',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.ResourcePool),
});

registerSidebarEntry({
  parent: 'capsule-quotas-section',
  name: 'global-custom-quotas',
  label: 'Global Custom Quotas',
  icon: 'mdi:chart-bar-stacked',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.GlobalCustomQuota),
});

registerSidebarEntry({
  parent: 'capsule-quotas-section',
  name: 'custom-quotas',
  label: 'Custom Quotas',
  icon: 'mdi:chart-pie',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.CustomQuota),
});

registerSidebarEntry({
  parent: 'capsule',
  name: 'capsule-replications-section',
  label: 'Replications',
  icon: 'mdi:source-branch-sync',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.GlobalTenantResource),
});

registerSidebarEntry({
  parent: 'capsule-replications-section',
  name: 'global-tenant-resources',
  label: 'Global Tenant Resources',
  icon: 'mdi:file-document-multiple',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.GlobalTenantResource),
});

registerSidebarEntry({
  parent: 'capsule-replications-section',
  name: 'tenant-resources',
  label: 'Tenant Resources',
  icon: 'mdi:file-document',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.TenantResource),
});

registerSidebarEntry({
  parent: 'capsule',
  name: 'capsule-proxy-section',
  label: 'Proxy',
  icon: 'mdi:server-network',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.GlobalProxySettings),
});

registerSidebarEntry({
  parent: 'capsule-proxy-section',
  name: 'global-proxy-settings',
  label: 'Global Proxy Settings',
  icon: 'mdi:shield-search',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.GlobalProxySettings),
});

registerSidebarEntry({
  parent: 'capsule',
  name: 'capsule-settings-section',
  label: 'Settings',
  icon: 'mdi:cog-outline',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.CapsuleConfiguration),
});

registerSidebarEntry({
  parent: 'capsule-settings-section',
  name: 'capsule-configurations',
  label: 'Capsule Configuration',
  icon: 'mdi:tune-variant',
  url: capsuleCustomResourceListPath(CAPSULE_CRDS.CapsuleConfiguration),
});

registerRoute({
  path: '/capsule/overview/',
  sidebar: 'overview',
  name: 'capsule-overview',
  component: () => <CapsuleOverview />,
  exact: true,
});

registerRoute({
  path: '/capsule/tenants/',
  sidebar: 'tenants',
  name: 'tenants',
  component: () => <TenantsList />,
  exact: true,
});

registerRoute({
  path: '/capsule/tenants/:name',
  sidebar: 'tenants',
  name: 'tenant',
  component: () => {
    return <TenantDetail />;
  },
  exact: true,
});

registerRoute({
  path: '/capsule/tenant-owners/',
  sidebar: 'tenant-owners',
  name: 'tenantowners',
  component: () => <TenantOwnersList />,
  exact: true,
});

registerRoute({
  path: '/capsule/tenant-owners/:name',
  sidebar: 'tenant-owners',
  name: 'tenantowner',
  component: () => <TenantOwnerDetail />,
  exact: true,
});

registerRoute({
  path: '/capsule/global-custom-quotas/',
  sidebar: 'global-custom-quotas',
  name: 'globalcustomquotas',
  component: () => <GlobalCustomQuotasList />,
  exact: true,
});

registerRoute({
  path: '/capsule/global-custom-quotas/:name',
  sidebar: 'global-custom-quotas',
  name: 'globalcustomquota',
  component: () => <GlobalCustomQuotaDetail />,
  exact: true,
});

registerRoute({
  path: '/capsule/custom-quotas/',
  sidebar: 'custom-quotas',
  name: 'customquotas',
  component: () => <CustomQuotasList />,
  exact: true,
});

registerRoute({
  path: '/capsule/custom-quotas/:namespace/:name',
  sidebar: 'custom-quotas',
  name: 'customquota',
  component: () => <CustomQuotaDetail />,
  exact: true,
});

registerRoute({
  path: '/capsule/global-resource-quotas/',
  sidebar: 'global-resource-quotas',
  name: 'globalresourcequotas',
  component: () => <GlobalResourceQuotasList />,
  exact: true,
});

registerRoute({
  path: '/capsule/global-resource-quotas/:name',
  sidebar: 'global-resource-quotas',
  name: 'globalresourcequota',
  component: () => <GlobalResourceQuotaDetail />,
  exact: true,
});

registerRoute({
  path: '/capsule/resource-pools/',
  sidebar: 'resource-pools',
  name: 'resourcepools',
  component: () => <ResourcePoolsList />,
  exact: true,
});

registerRoute({
  path: '/capsule/resource-pools/:name',
  sidebar: 'resource-pools',
  name: 'resourcepool',
  component: () => <ResourcePoolDetail />,
  exact: true,
});

registerRoute({
  path: '/capsule/resource-pool-claims/:namespace/:name',
  sidebar: 'resource-pools',
  name: 'resourcepoolclaim',
  component: () => <ResourcePoolClaimDetail />,
  exact: true,
});

registerRoute({
  path: '/capsule/global-tenant-resources/',
  sidebar: 'global-tenant-resources',
  name: 'globaltenantresources',
  component: () => <GlobalTenantResourcesList />,
  exact: true,
});

registerRoute({
  path: '/capsule/global-tenant-resources/:name',
  sidebar: 'global-tenant-resources',
  name: 'globaltenantresource',
  component: () => <GlobalTenantResourceDetail />,
  exact: true,
});

registerRoute({
  path: '/capsule/tenant-resources/',
  sidebar: 'tenant-resources',
  name: 'tenantresources',
  component: () => <TenantResourcesList />,
  exact: true,
});

registerRoute({
  path: '/capsule/tenant-resources/:namespace/:name',
  sidebar: 'tenant-resources',
  name: 'tenantresource',
  component: () => <TenantResourceDetail />,
  exact: true,
});

registerRoute({
  path: '/capsule/global-proxy-settings/',
  sidebar: 'global-proxy-settings',
  name: 'globalproxysettings',
  component: () => <GlobalProxySettingsList />,
  exact: true,
});

registerRoute({
  path: '/capsule/global-proxy-settings/:name',
  sidebar: 'global-proxy-settings',
  name: 'globalproxysetting',
  component: () => <GlobalProxySettingsDetail />,
  exact: true,
});

registerRoute({
  path: '/capsule/settings/',
  sidebar: 'capsule-configurations',
  name: 'capsuleconfigurations',
  component: () => <CapsuleConfigurationList />,
  exact: true,
});

registerRoute({
  path: '/capsule/settings/:name',
  sidebar: 'capsule-configurations',
  name: 'capsuleconfiguration',
  component: () => <CapsuleConfigurationDetail />,
  exact: true,
});

registerDetailsViewHeaderAction(NamespaceCordonAction);
registerDetailsViewHeaderAction(ServiceAccountPromotionAction);

registerDetailsViewHeaderActionsProcessor({
  id: 'capsule.documentation-action',
  processor: (resource, actions) =>
    insertDocumentationAction(resource, actions, {
      id: CAPSULE_DOCUMENTATION_ACTION_ID,
      action: CapsuleDocumentationAction,
    }),
});

registerDetailsViewSectionsProcessor({
  id: 'capsule.namespace-details',
  processor: processNamespaceDetailsSections,
});

registerDetailsViewSectionsProcessor({
  id: 'capsule.persistentvolume-tenant-details',
  processor: processPersistentVolumeDetailsSections,
});

registerDetailsViewHeaderAction(TenantCordonAction);
registerDetailsViewHeaderAction(TenantResourceCordonAction);
registerDetailsViewHeaderAction(TenantResourceReconcileAction);
registerDetailsViewHeaderAction(GlobalTenantResourceCordonAction);
registerDetailsViewHeaderAction(GlobalTenantResourceReconcileAction);

(RESOURCE_DEFINITIONS as any).Tenant = {
  class: Tenants,
  form: CreateTenantForm,
};
(RESOURCE_DEFINITIONS as any).CapsuleConfiguration = {
  class: CapsuleConfiguration,
};
(RESOURCE_DEFINITIONS as any).TenantOwner = {
  class: TenantOwner,
};
(RESOURCE_DEFINITIONS as any).GlobalCustomQuota = {
  class: GlobalCustomQuota,
  form: CreateGlobalCustomQuotaForm,
};
(RESOURCE_DEFINITIONS as any).CustomQuota = {
  class: CustomQuota,
  form: CreateCustomQuotaForm,
};
(RESOURCE_DEFINITIONS as any).GlobalResourceQuota = {
  class: GlobalResourceQuota,
};
(RESOURCE_DEFINITIONS as any).GlobalProxySettings = {
  class: GlobalProxySettings,
};
(RESOURCE_DEFINITIONS as any).ResourcePool = {
  class: ResourcePool,
};
(RESOURCE_DEFINITIONS as any).ResourcePoolClaim = {
  class: ResourcePoolClaim,
};
(RESOURCE_DEFINITIONS as any).GlobalTenantResource = {
  class: GlobalTenantResource,
  form: CreateGlobalTenantResourceForm,
};
(RESOURCE_DEFINITIONS as any).TenantResource = {
  class: TenantResource,
  form: CreateTenantResourceForm,
};
