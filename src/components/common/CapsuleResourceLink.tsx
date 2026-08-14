import { Router } from '@kinvolk/headlamp-plugin/lib';
import { Link as MuiLink } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { capsuleCustomResourceRouteParams } from '../../resources/capsuleCustomResources';

export interface CapsuleResourceLinkProps {
  children?: ReactNode;
  crd: string;
  name: string;
  namespace?: string;
}

/**
 * Canonical full-page link for Capsule custom resources.
 *
 * Headlamp's standard `customresource` Link opens its generic detail drawer
 * when drawer mode is enabled. These resources have full rich pages, so bypass
 * that interception while retaining Headlamp's cluster-aware canonical URL.
 */
export function CapsuleResourceLink({ children, crd, name, namespace }: CapsuleResourceLinkProps) {
  const to = Router.createRouteURL(
    'customresource',
    capsuleCustomResourceRouteParams(crd, name, namespace)
  );

  return (
    <MuiLink component={RouterLink} to={to} sx={{ cursor: 'pointer' }}>
      {children || name}
    </MuiLink>
  );
}

export default CapsuleResourceLink;
