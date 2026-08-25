import { SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Resource from '@kinvolk/headlamp-plugin/lib/components/common';
import { Chip, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { TenantOwner } from '../../resources/tenantOwners';
import { Tenants } from '../../resources/tenants';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { TenantOwnerFlow } from './TenantOwnerFlow';
import {
  referencedTenantsForOwner,
  tenantOwnerIdentity,
  tenantOwnerReportedTenantNames,
} from './tenantOwnerReferences';

export interface TenantOwnerDetailProps {
  name?: string;
}

export function TenantOwnerDetail(props: TenantOwnerDetailProps) {
  const params = useParams<{ name: string }>();
  const { name = params.name } = props;
  const [owners] = TenantOwner.useList();
  const [tenants] = Tenants.useList();
  const owner = owners?.find(item => item.getName() === name);
  const references = useMemo(() => referencedTenantsForOwner(owner, tenants), [owner, tenants]);
  const unresolvedNames = useMemo(() => {
    const resolved = new Set(references.map(tenant => tenant.getName()));
    return tenantOwnerReportedTenantNames(owner).filter(tenantName => !resolved.has(tenantName));
  }, [owner, references]);

  return (
    <Resource.DetailsGrid
      name={name}
      resourceType={TenantOwner}
      extraInfo={item => {
        if (!item) return [];
        const identity = tenantOwnerIdentity(item);
        return [
          { name: 'Kind', value: <Chip size="small" label={identity.kind} /> },
          { name: 'Identity', value: <Typography>{identity.name || '—'}</Typography> },
          {
            name: 'Aggregate roles',
            value: (
              <Chip size="small" label={item.spec?.aggregate === false ? 'Disabled' : 'Enabled'} />
            ),
          },
          {
            name: 'Cluster roles',
            value: (
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {(item.spec?.clusterRoles || []).map(role => (
                  <Chip key={role} size="small" label={role} variant="outlined" />
                ))}
              </Stack>
            ),
          },
          { name: 'Referenced by', value: <Typography>{references.length} tenants</Typography> },
        ];
      }}
    >
      <DetailsSectionStack>
        <ConditionsAndEvents resource={owner} />
        <SectionBox title="Tenant References">
          {references.length === 0 ? (
            <Typography color="text.secondary">
              This TenantOwner identity is not currently referenced by any visible Tenant.
            </Typography>
          ) : (
            <Stack spacing={2.5}>
              <Typography variant="body2" color="text.secondary">
                Animated edges show every Tenant whose owner identity matches this TenantOwner.
                Select a Tenant card to open its Capsule detail page.
              </Typography>
              <TenantOwnerFlow owner={owner} tenants={references} />
              <SimpleTable
                columns={[
                  {
                    label: 'Tenant',
                    getter: (tenant: any) => (
                      <CapsuleResourceLink crd={CAPSULE_CRDS.Tenant} name={tenant.getName()}>
                        {tenant.getName()}
                      </CapsuleResourceLink>
                    ),
                  },
                  {
                    label: 'State',
                    getter: (tenant: any) => tenant.status?.state || 'Active',
                  },
                  {
                    label: 'Namespaces',
                    getter: (tenant: any) =>
                      (Array.isArray(tenant.status?.namespaces)
                        ? tenant.status.namespaces.length
                        : tenant.status?.size) || 0,
                  },
                ]}
                data={references}
                emptyMessage="No Tenant references."
                reflectInURL={false}
              />
            </Stack>
          )}
          {unresolvedNames.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              Controller-reported Tenants not visible to this account: {unresolvedNames.join(', ')}
            </Typography>
          )}
        </SectionBox>
      </DetailsSectionStack>
    </Resource.DetailsGrid>
  );
}

export default TenantOwnerDetail;
