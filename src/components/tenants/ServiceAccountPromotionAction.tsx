import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { ActionButton } from '@kinvolk/headlamp-plugin/lib/components/common';
import { useSnackbar } from 'notistack';
import { useMemo, useState } from 'react';
import { CapsuleConfiguration } from '../../resources/capsuleConfigurations';
import { Tenants } from '../../resources/tenants';
import { getTenantSpaceNames } from '../../utils/tenantSpaces';
import {
  buildServiceAccountPromotionRequest,
  capsuleConfigurationAllowsServiceAccountPromotion,
  isServiceAccountPromoted,
  replaceServiceAccountData,
} from './serviceAccountPromotion';

export function ServiceAccountPromotionAction(props: any) {
  const [tenants] = Tenants.useList();
  const [capsuleConfigurations] = CapsuleConfiguration.useList();
  const [optimisticPromoted, setOptimisticPromoted] = useState<boolean | null>(null);
  const [updating, setUpdating] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  let resource = props.item || props.resource;
  if (resource?.item && !resource.jsonData && !resource.kind) resource = resource.item;

  const request = buildServiceAccountPromotionRequest(resource, true);
  const tenant = useMemo(() => {
    if (!request) return undefined;
    return tenants?.find((candidate: any) =>
      getTenantSpaceNames(candidate).includes(request.namespace)
    );
  }, [request?.namespace, tenants]);

  if (!request || !tenant) return null;

  const tenantName = tenant.getName?.() || tenant.metadata?.name || tenant.jsonData?.metadata?.name;
  const globallyAllowed = capsuleConfigurationAllowsServiceAccountPromotion(
    capsuleConfigurations || []
  );
  const tenantAllowsPromotion =
    (tenant.spec || tenant.jsonData?.spec)?.permissions?.allowOwnerPromotion !== false;
  const promotionAllowed = globallyAllowed && tenantAllowsPromotion;
  const promoted =
    optimisticPromoted === null ? isServiceAccountPromoted(resource) : optimisticPromoted;

  const togglePromotion = async () => {
    if (updating || !promotionAllowed) return;
    const target = !promoted;
    const actionRequest = buildServiceAccountPromotionRequest(resource, target);
    if (!actionRequest) return;

    setUpdating(true);
    setOptimisticPromoted(target);
    try {
      await ApiProxy.patch(actionRequest.url, actionRequest.body);
      const refreshed = await ApiProxy.request(actionRequest.url);
      replaceServiceAccountData(resource, refreshed);
      setOptimisticPromoted(isServiceAccountPromoted(refreshed));
      enqueueSnackbar(
        `${actionRequest.namespace}/${actionRequest.name} ${
          target ? 'promoted to' : 'removed from'
        } Tenant ${tenantName} owners`,
        { variant: 'success' }
      );
    } catch (error: any) {
      setOptimisticPromoted(promoted);
      enqueueSnackbar(
        `Failed to ${target ? 'promote' : 'revoke'} ServiceAccount owner access: ${
          error?.message || String(error)
        }`,
        { variant: 'error' }
      );
    } finally {
      setUpdating(false);
    }
  };

  const action = promoted ? 'Revoke Tenant Owner promotion' : 'Promote to Tenant Owner';
  const longDescription = promotionAllowed
    ? `${action} for Tenant ${tenantName}. Capsule requires the signed-in identity to be a Tenant owner.`
    : !globallyAllowed
    ? 'ServiceAccount owner promotion is disabled in CapsuleConfiguration'
    : `Owner promotion is disabled by Tenant ${tenantName}`;

  return (
    <ActionButton
      description={action}
      longDescription={longDescription}
      icon={promoted ? 'mdi:account-arrow-down' : 'mdi:account-arrow-up'}
      color="primary"
      onClick={togglePromotion}
      iconButtonProps={{
        disabled: updating || !promotionAllowed,
        'aria-busy': updating,
      }}
    />
  );
}

export default ServiceAccountPromotionAction;
