import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { Link, SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { GlobalProxySettings } from '../../resources/globalProxySettings';
import { TenantOwner } from '../../resources/tenantOwners';
import { Tenants } from '../../resources/tenants';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';
import { globalProxyReadyCondition } from '../proxy/globalProxySettingsHelpers';
import { capsuleTagNamespacesFromSearch } from '../tags/capsuleTags';
import { tenantOwnerReportedTenantNames } from '../tenant-owners/tenantOwnerReferences';
import {
  bindingMentionsSubject,
  type CapsuleSubject,
  capsuleSubjectLabel,
  globalProxySettingsSubjectMentions,
  normalizeCapsuleSubject,
  tenantOwnerMentionsSubject,
  tenantPromotionsForSubject,
  tenantSubjectMentions,
} from './subjectReferences';

function decoded(value: string | undefined): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function MentionChips({ mentions }: { mentions: string[] }) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.5}>
      {mentions.map(mention => (
        <Chip key={mention} size="small" label={mention} variant="outlined" />
      ))}
    </Stack>
  );
}

export interface CapsuleSubjectSummaryProps {
  kind?: string;
  name?: string;
  namespaces?: string[];
}

export function CapsuleSubjectSummary(props: CapsuleSubjectSummaryProps = {}) {
  const params = useParams<{ kind: string; subject: string }>();
  const location = useLocation();
  const subject: CapsuleSubject = normalizeCapsuleSubject({
    kind: props.kind || decoded(params.kind),
    name: props.name || decoded(params.subject),
  }) || {
    kind: props.kind || decoded(params.kind) || 'Unknown',
    name: props.name || decoded(params.subject) || 'Unknown',
  };
  const namespaces = useMemo(
    () => props.namespaces ?? capsuleTagNamespacesFromSearch(location.search),
    [location.search, props.namespaces]
  );
  const namespaceScope = namespaces.length > 0 ? namespaces : undefined;
  const [tenants, tenantsError] = Tenants.useList();
  const [tenantOwners, tenantOwnersError] = TenantOwner.useList();
  const [globalProxySettings, globalProxySettingsError] = GlobalProxySettings.useList();
  const [roleBindings, roleBindingsError] = K8s.ResourceClasses.RoleBinding.useList({
    namespace: namespaceScope,
  });
  const [clusterRoleBindings, clusterRoleBindingsError] =
    K8s.ResourceClasses.ClusterRoleBinding.useList();

  const tenantRows = useMemo(
    () =>
      (tenants || [])
        .map(item => ({ item, mentions: tenantSubjectMentions(item, subject) }))
        .filter(row => row.mentions.length > 0)
        .sort((left, right) => left.item.getName().localeCompare(right.item.getName())),
    [subject, tenants]
  );
  const promotionRows = useMemo(
    () =>
      (tenants || [])
        .flatMap(item =>
          tenantPromotionsForSubject(item, subject).map(promotion => ({ item, promotion }))
        )
        .sort(
          (left, right) =>
            left.item.getName().localeCompare(right.item.getName()) ||
            left.promotion.namespace.localeCompare(right.promotion.namespace) ||
            left.promotion.name.localeCompare(right.promotion.name)
        ),
    [subject, tenants]
  );
  const bindingRows = useMemo(
    () =>
      [
        ...(roleBindings || [])
          .filter(item => bindingMentionsSubject(item, subject))
          .map(item => ({ item, type: 'RoleBinding' })),
        ...(clusterRoleBindings || [])
          .filter(item => bindingMentionsSubject(item, subject))
          .map(item => ({ item, type: 'ClusterRoleBinding' })),
      ].sort(
        (left, right) =>
          left.type.localeCompare(right.type) ||
          String(left.item.getNamespace() || '').localeCompare(
            String(right.item.getNamespace() || '')
          ) ||
          left.item.getName().localeCompare(right.item.getName())
      ),
    [clusterRoleBindings, roleBindings, subject]
  );

  const tenantOwnerRows = useMemo(
    () =>
      (tenantOwners || [])
        .filter(item => tenantOwnerMentionsSubject(item, subject))
        .sort((left, right) => left.getName().localeCompare(right.getName())),
    [subject, tenantOwners]
  );
  const globalProxySettingsRows = useMemo(
    () =>
      (globalProxySettings || [])
        .map(item => {
          const mentions = globalProxySettingsSubjectMentions(item, subject);
          const matchingRules = (item.spec?.rules || []).filter((_, index) =>
            mentions.includes(`Rule #${index + 1}`)
          );
          return {
            item,
            mentions,
            resourceGrants: matchingRules.reduce(
              (total, rule) => total + (rule.clusterResources?.length || 0),
              0
            ),
          };
        })
        .filter(row => row.mentions.length > 0)
        .sort((left, right) => left.item.getName().localeCompare(right.item.getName())),
    [globalProxySettings, subject]
  );
  const namespacedBindingCount = bindingRows.filter(row => row.type === 'RoleBinding').length;
  const clusterBindingCount = bindingRows.length - namespacedBindingCount;
  const subjectLabel = subject ? capsuleSubjectLabel(subject) : 'Unknown subject';
  const scopedDescription = namespaces.length
    ? namespaces.join(', ')
    : 'the account’s permitted all-Namespace scope';
  const inventoriesLoading =
    (!tenants && !tenantsError) ||
    (!tenantOwners && !tenantOwnersError) ||
    (!globalProxySettings && !globalProxySettingsError) ||
    (!roleBindings && !roleBindingsError) ||
    (!clusterRoleBindings && !clusterRoleBindingsError);

  return (
    <>
      <SectionBox title={`Subject: ${subjectLabel}`}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
          <Chip color="primary" label={subject?.kind || 'Unknown'} />
          <Typography>
            References are correlated from visible Capsule and RBAC resources. Namespaced searches
            currently cover {scopedDescription}; Global Proxy Settings are cluster-scoped.
          </Typography>
        </Stack>
      </SectionBox>

      <SummaryCardGrid columns={4} marginBottom={2} inset>
        <StatCard
          label="TENANTS"
          total={tenantsError ? 'Unavailable' : tenantRows.length}
          segments={[{ name: 'Tenants', value: tenantRows.length, color: '#1976d2' }]}
          chips={[{ label: `${tenantRows.length} Visible`, color: 'primary' }]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Owners and promoted identities
            </Typography>
          }
        />
        <StatCard
          label="TENANT OWNERS"
          total={tenantOwnersError ? 'Unavailable' : tenantOwnerRows.length}
          segments={[{ name: 'TenantOwners', value: tenantOwnerRows.length, color: '#00897b' }]}
          chips={[{ label: `${tenantOwnerRows.length} Visible`, color: 'success' }]}
          footer={
            <Typography variant="caption" color="text.secondary">
              Exact identity entries
            </Typography>
          }
        />

        <StatCard
          label="BINDINGS"
          total={roleBindingsError && clusterRoleBindingsError ? 'Unavailable' : bindingRows.length}
          segments={[
            { name: 'RoleBindings', value: namespacedBindingCount, color: '#7b1fa2' },
            { name: 'ClusterRoleBindings', value: clusterBindingCount, color: '#00897b' },
          ]}
          chips={[
            { label: `${namespacedBindingCount} RoleBindings`, color: 'info' },
            { label: `${clusterBindingCount} ClusterRoleBindings`, color: 'success' },
          ]}
        />
      </SummaryCardGrid>

      {inventoriesLoading && (
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1, px: 2, py: 1 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Loading visible references…</Typography>
        </Box>
      )}
      {tenantsError && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Tenants are unavailable to this account. Kubernetes only returns references this signed-in
          account is allowed to list.
        </Alert>
      )}
      {tenantOwnersError && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          TenantOwners are unavailable to this account. Kubernetes only returns references this
          signed-in account is allowed to list.
        </Alert>
      )}

      {globalProxySettingsError && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          GlobalProxySettings are unavailable. Capsule Proxy may not be installed, or this account
          cannot list its cluster-scoped settings.
        </Alert>
      )}
      {roleBindingsError && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          RoleBindings are unavailable in {scopedDescription}. Select Namespaces where this account
          has list access to include namespaced bindings.
        </Alert>
      )}
      {clusterRoleBindingsError && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          ClusterRoleBindings are unavailable to this account.
        </Alert>
      )}

      {tenantRows.length > 0 && (
        <SectionBox title="Tenants">
          <SimpleTable
            columns={[
              {
                label: 'Tenant',
                getter: (row: (typeof tenantRows)[number]) => (
                  <CapsuleResourceLink crd={CAPSULE_CRDS.Tenant} name={row.item.getName()}>
                    {row.item.getName()}
                  </CapsuleResourceLink>
                ),
              },
              {
                label: 'Relationship',
                getter: (row: (typeof tenantRows)[number]) => (
                  <MentionChips mentions={row.mentions} />
                ),
              },
              {
                label: 'State',
                getter: (row: (typeof tenantRows)[number]) => row.item.status?.state || 'Unknown',
              },
            ]}
            data={tenantRows}
            emptyMessage="No visible Tenant mentions this subject."
            reflectInURL={false}
          />
        </SectionBox>
      )}

      {promotionRows.length > 0 && (
        <SectionBox title="Promotions">
          <SimpleTable
            columns={[
              {
                label: 'Tenant',
                getter: (row: (typeof promotionRows)[number]) => (
                  <CapsuleResourceLink crd={CAPSULE_CRDS.Tenant} name={row.item.getName()}>
                    {row.item.getName()}
                  </CapsuleResourceLink>
                ),
              },
              {
                label: 'Namespace',
                getter: (row: (typeof promotionRows)[number]) => (
                  <Link
                    routeName="namespace"
                    params={{ name: row.promotion.namespace }}
                    activeCluster={row.item.cluster}
                  >
                    {row.promotion.namespace}
                  </Link>
                ),
              },
              {
                label: 'Cluster Roles',
                getter: (row: (typeof promotionRows)[number]) =>
                  row.promotion.clusterRoles.length > 0 ? (
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {row.promotion.clusterRoles.map(role => (
                        <Chip key={role} size="small" label={role} variant="outlined" />
                      ))}
                    </Stack>
                  ) : (
                    '—'
                  ),
              },
              {
                label: 'Targets',
                getter: (row: (typeof promotionRows)[number]) =>
                  row.promotion.targets.length > 0 ? (
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {row.promotion.targets.map(target => (
                        <Chip key={target} size="small" label={target} color="primary" />
                      ))}
                    </Stack>
                  ) : (
                    'All Tenant namespaces'
                  ),
              },
            ]}
            data={promotionRows}
            emptyMessage=""
            reflectInURL={false}
          />
        </SectionBox>
      )}

      {tenantOwnerRows.length > 0 && (
        <SectionBox title="Tenant Owners">
          <SimpleTable
            columns={[
              {
                label: 'TenantOwner',
                getter: (item: (typeof tenantOwnerRows)[number]) => (
                  <CapsuleResourceLink crd={CAPSULE_CRDS.TenantOwner} name={item.getName()}>
                    {item.getName()}
                  </CapsuleResourceLink>
                ),
              },
              {
                label: 'Cluster Roles',
                getter: (item: (typeof tenantOwnerRows)[number]) => (
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {(item.spec?.clusterRoles || []).map(role => (
                      <Chip key={role} size="small" label={role} variant="outlined" />
                    ))}
                  </Stack>
                ),
              },
              {
                label: 'Reported Tenants',
                getter: (item: (typeof tenantOwnerRows)[number]) => (
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {tenantOwnerReportedTenantNames(item).map(tenantName => (
                      <CapsuleResourceLink
                        key={tenantName}
                        crd={CAPSULE_CRDS.Tenant}
                        name={tenantName}
                      >
                        {tenantName}
                      </CapsuleResourceLink>
                    ))}
                  </Stack>
                ),
              },
            ]}
            data={tenantOwnerRows}
            emptyMessage=""
            reflectInURL={false}
          />
        </SectionBox>
      )}

      {globalProxySettingsRows.length > 0 && (
        <SectionBox title="Global Proxy Settings">
          <SimpleTable
            columns={[
              {
                label: 'GlobalProxySettings',
                getter: (row: (typeof globalProxySettingsRows)[number]) => (
                  <CapsuleResourceLink
                    crd={CAPSULE_CRDS.GlobalProxySettings}
                    name={row.item.getName()}
                  >
                    {row.item.getName()}
                  </CapsuleResourceLink>
                ),
              },
              {
                label: 'Matching Rules',
                getter: (row: (typeof globalProxySettingsRows)[number]) => (
                  <MentionChips mentions={row.mentions} />
                ),
              },
              {
                label: 'Cluster Resource Grants',
                getter: (row: (typeof globalProxySettingsRows)[number]) => row.resourceGrants,
              },
              {
                label: 'Ready',
                getter: (row: (typeof globalProxySettingsRows)[number]) => {
                  const ready = String(globalProxyReadyCondition(row.item)?.status || 'Unknown');
                  return (
                    <Chip
                      size="small"
                      label={ready}
                      color={ready.toLowerCase() === 'true' ? 'success' : 'default'}
                    />
                  );
                },
              },
            ]}
            data={globalProxySettingsRows}
            emptyMessage=""
            reflectInURL={false}
          />
        </SectionBox>
      )}

      {bindingRows.length > 0 && (
        <SectionBox title="Bindings">
          <SimpleTable
            columns={[
              {
                label: 'Binding',
                getter: (row: (typeof bindingRows)[number]) => (
                  <Link kubeObject={row.item}>{row.item.getName()}</Link>
                ),
              },
              { label: 'Kind', getter: (row: (typeof bindingRows)[number]) => row.type },
              {
                label: 'Namespace',
                getter: (row: (typeof bindingRows)[number]) => row.item.getNamespace() || 'Cluster',
              },
              {
                label: 'Role',
                getter: (row: (typeof bindingRows)[number]) =>
                  `${row.item.roleRef?.kind || 'Role'}/${row.item.roleRef?.name || 'Unknown'}`,
              },
            ]}
            data={bindingRows}
            emptyMessage="No visible RoleBinding or ClusterRoleBinding mentions this subject."
            reflectInURL={false}
          />
        </SectionBox>
      )}
    </>
  );
}

export default CapsuleSubjectSummary;
