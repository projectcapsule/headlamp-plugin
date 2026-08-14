import { Icon } from '@iconify/react';
import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { CircularProgress, IconButton, Tooltip } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import {
  buildResourcePoolClaimReleaseRequest,
  canReleaseResourcePoolClaim,
  replaceResourcePoolClaimData,
} from './resourcePoolClaimRelease';

export function ResourcePoolClaimReleaseAction({
  claim,
  onReleased,
}: {
  claim?: any;
  onReleased?: () => void;
}) {
  const [updating, setUpdating] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  if (!claim) return null;

  const releasable = canReleaseResourcePoolClaim(claim);
  const tooltip = releasable
    ? 'Release claim and immediately requeue it'
    : 'Release is available after the claim has freed its resources (Bound=False)';

  const release = async () => {
    const request = buildResourcePoolClaimReleaseRequest(claim);
    if (!request || updating) return;
    setUpdating(true);
    try {
      await ApiProxy.patch(request.url, request.body);
      try {
        const refreshed = await ApiProxy.request(request.url);
        replaceResourcePoolClaimData(claim, refreshed);
      } catch {
        // The watch will still reconcile the table; the release request itself succeeded.
      }
      onReleased?.();
      enqueueSnackbar(
        `Release requested for ResourcePoolClaim ${request.namespace}/${request.name}`,
        {
          variant: 'success',
        }
      );
    } catch (error: any) {
      enqueueSnackbar(`Failed to release ResourcePoolClaim: ${error?.message || String(error)}`, {
        variant: 'error',
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Tooltip title={tooltip}>
      <span>
        <IconButton
          aria-label="Release ResourcePoolClaim"
          color="primary"
          disabled={!releasable || updating}
          onClick={release}
          size="small"
        >
          {updating ? <CircularProgress size={18} /> : <Icon icon="mdi:link-off" width={20} />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export default ResourcePoolClaimReleaseAction;
