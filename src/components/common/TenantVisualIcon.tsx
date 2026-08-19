import { Icon } from '@iconify/react';
import { Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { isIconifyRef, isImageRef, safeUrl } from '../../utils/tenantMeta';
import { CapsuleIcon } from './CapsuleIcon';

export interface TenantVisualIconProps {
  icon?: string;
  size?: number;
}

/**
 * Renders a Tenant's annotation icon and falls back to the Capsule mark when
 * the annotation is absent, invalid, or points to an image that fails to load.
 */
export function TenantVisualIcon({ icon, size = 24 }: TenantVisualIconProps) {
  const imageUrl = isImageRef(icon) ? safeUrl(icon) : undefined;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [imageUrl]);

  if (imageUrl && !imageFailed) {
    return (
      <Box
        alt=""
        component="img"
        onError={() => setImageFailed(true)}
        src={imageUrl}
        sx={{ borderRadius: '4px', height: size, objectFit: 'contain', width: size }}
      />
    );
  }

  if (isIconifyRef(icon)) {
    return <Icon aria-hidden icon={icon!} width={size} height={size} />;
  }

  return <CapsuleIcon size={size} />;
}
