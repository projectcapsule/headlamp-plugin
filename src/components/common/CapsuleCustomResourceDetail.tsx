import { useParams } from 'react-router-dom';
import { CapsuleConfigurationDetail } from '../configuration/CapsuleConfigurationDetail';
import { CapsuleConfigurationList } from '../configuration/CapsuleConfigurationList';
import { GlobalProxySettingsDetail } from '../proxy/GlobalProxySettingsDetail';
import { GlobalProxySettingsList } from '../proxy/GlobalProxySettingsList';
import { CustomQuotaDetail } from '../quotas/CustomQuotaDetail';
import { CustomQuotasList } from '../quotas/CustomQuotaList';
import { GlobalCustomQuotaDetail } from '../quotas/GlobalCustomQuotaDetail';
import { GlobalCustomQuotasList } from '../quotas/GlobalCustomQuotaList';
import { GlobalResourceQuotaDetail } from '../quotas/GlobalResourceQuotaDetail';
import { GlobalResourceQuotasList } from '../quotas/GlobalResourceQuotaList';
import { ResourcePoolDetail } from '../quotas/ResourcePoolDetail';
import { ResourcePoolsList } from '../quotas/ResourcePoolList';
import { TenantOwnerDetail } from '../tenant-owners/TenantOwnerDetail';
import { TenantOwnersList } from '../tenant-owners/TenantOwnerList';
import { GlobalTenantResourceDetail } from '../tenant-resources/GlobalTenantResourceDetail';
import { GlobalTenantResourcesList } from '../tenant-resources/GlobalTenantResourceList';
import { TenantResourceDetail } from '../tenant-resources/TenantResourceDetail';
import { TenantResourcesList } from '../tenant-resources/TenantResourceList';
import { TenantDetail } from '../tenants/TenantDetail';
import { TenantsList } from '../tenants/TenantList';

export type CapsuleCustomResourceDetailKind =
  | 'CapsuleConfiguration'
  | 'CustomQuota'
  | 'GlobalCustomQuota'
  | 'GlobalProxySettings'
  | 'GlobalResourceQuota'
  | 'GlobalTenantResource'
  | 'ResourcePool'
  | 'Tenant'
  | 'TenantOwner'
  | 'TenantResource';

/** Reuses the rich plugin detail page at Headlamp's canonical CR instance URL. */
export function CapsuleCustomResourceDetail({ kind }: { kind: CapsuleCustomResourceDetailKind }) {
  const { crName, namespace } = useParams<{ crName: string; namespace: string }>();
  const objectNamespace = namespace === '-' ? undefined : namespace;

  switch (kind) {
    case 'CapsuleConfiguration':
      return <CapsuleConfigurationDetail name={crName} />;
    case 'Tenant':
      return <TenantDetail name={crName} />;
    case 'TenantOwner':
      return <TenantOwnerDetail name={crName} />;
    case 'CustomQuota':
      return <CustomQuotaDetail name={crName} namespace={objectNamespace} />;
    case 'GlobalCustomQuota':
      return <GlobalCustomQuotaDetail name={crName} />;
    case 'GlobalProxySettings':
      return <GlobalProxySettingsDetail name={crName} />;
    case 'GlobalResourceQuota':
      return <GlobalResourceQuotaDetail name={crName} />;
    case 'ResourcePool':
      return <ResourcePoolDetail name={crName} />;
    case 'TenantResource':
      return <TenantResourceDetail name={crName} namespace={objectNamespace} />;
    case 'GlobalTenantResource':
      return <GlobalTenantResourceDetail name={crName} />;
  }
}

/** Reuses each plugin overview at the canonical Headlamp CRD list URL. */
export function CapsuleCustomResourceList({ kind }: { kind: CapsuleCustomResourceDetailKind }) {
  switch (kind) {
    case 'CapsuleConfiguration':
      return <CapsuleConfigurationList />;
    case 'Tenant':
      return <TenantsList />;
    case 'TenantOwner':
      return <TenantOwnersList />;
    case 'CustomQuota':
      return <CustomQuotasList />;
    case 'GlobalCustomQuota':
      return <GlobalCustomQuotasList />;
    case 'GlobalProxySettings':
      return <GlobalProxySettingsList />;
    case 'GlobalResourceQuota':
      return <GlobalResourceQuotasList />;
    case 'ResourcePool':
      return <ResourcePoolsList />;
    case 'TenantResource':
      return <TenantResourcesList />;
    case 'GlobalTenantResource':
      return <GlobalTenantResourcesList />;
  }
}

export default CapsuleCustomResourceDetail;
