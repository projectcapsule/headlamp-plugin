import { Icon } from '@iconify/react';
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { Link, ResourceListView, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Resource, { SimpleTable } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Alert, AlertTitle, Avatar, Box, Chip, IconButton, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { Tenants } from '../../resources/tenants';
import {
  getTenantBanner,
  getTenantIcon,
  getTenantLinks,
  isImageRef,
  safeUrl,
} from '../../utils/tenantMeta';
import { getTenantSpaceNames } from '../../utils/tenantSpaces';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { NamespaceCordonAction } from '../common/ReconcileActions';
import { TENANT_REFRESH_EVENT } from '../common/tenantCordon';
import { TenantNamespaceFlow } from './TenantNamespaceFlow';
import { TenantQuotaOverview } from './TenantQuotaOverview';
import {
  type PromotedServiceAccount,
  tenantNamespaceQuota,
  tenantPromotedServiceAccounts,
} from './tenantStatusHelpers';

export interface TenantProps {
  name?: string;
}

export function TenantDetail(props: TenantProps) {
  const params = useParams<{ name: string }>();
  const { name = params.name } = props;
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const [tenants, tenantsError] = Tenants.useList();
  const [allNamespaces] = K8s.ResourceClasses.Namespace.useList();
  const listedTenant = useMemo(
    () => tenants?.find((item: any) => item.getName() === name),
    [tenants, name]
  );
  const [actionRefreshedTenant, setActionRefreshedTenant] = useState<any>();

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.name === name && detail.data) {
        setActionRefreshedTenant(new Tenants(detail.data));
      }
    };
    window.addEventListener(TENANT_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(TENANT_REFRESH_EVENT, handleRefresh);
  }, [name]);

  const tenant = useMemo(() => {
    if (!actionRefreshedTenant) return listedTenant;
    if (!listedTenant) return actionRefreshedTenant;
    const listedVersion = BigInt(listedTenant.metadata?.resourceVersion || 0);
    const refreshedVersion = BigInt(actionRefreshedTenant.metadata?.resourceVersion || 0);
    return listedVersion > refreshedVersion ? listedTenant : actionRefreshedTenant;
  }, [actionRefreshedTenant, listedTenant]);

  const tenantNamespaces = useMemo(() => {
    if (!allNamespaces || !tenant) return [];
    const names = new Set(getTenantSpaceNames(tenant));
    return allNamespaces.filter((namespace: any) => names.has(namespace.getName()));
  }, [allNamespaces, tenant]);

  const nsVal = tenant?.status?.namespaces ?? tenant?.jsonData?.status?.namespaces;
  const numNamespaces = typeof nsVal === 'number' ? nsVal : nsVal?.length ?? 0;
  const state = tenant?.status?.state || tenant?.jsonData?.status?.state || 'Active';
  const owners = tenant?.spec?.owners || tenant?.jsonData?.spec?.owners || [];
  const namespaceQuota = useMemo(() => tenantNamespaceQuota(tenant), [tenant]);
  const promotedServiceAccounts = useMemo(() => tenantPromotedServiceAccounts(tenant), [tenant]);
  const hasClassConfiguration = !!(
    tenant?.spec?.nodeSelector ||
    tenant?.spec?.storageClasses ||
    tenant?.spec?.ingressClasses
  );

  // Banner as sticky acknowledgeable notification
  useEffect(() => {
    if (!tenant) return;
    const banner = getTenantBanner(tenant);
    if (!banner) {
      setBannerDismissed(false);
      return;
    }
    const dismissed = localStorage.getItem(`banner-dismissed-${name}`);
    if (dismissed === banner) {
      setBannerDismissed(true);
    } else {
      setBannerDismissed(false);
    }
  }, [name, tenant]);

  return (
    <>
      {tenantsError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Error loading Tenant details: {tenantsError.message || String(tenantsError)}. Is the
          Capsule CRD present and do you have list permission?
        </Typography>
      )}

      {/* Banner */}
      {(() => {
        const banner = getTenantBanner(tenant);
        if (!banner || bannerDismissed) return null;
        return (
          <Alert
            severity="warning"
            sx={{ position: 'sticky', top: 0, zIndex: 1200, mb: 2 }}
            action={
              <IconButton
                aria-label="close"
                color="inherit"
                size="small"
                onClick={() => {
                  localStorage.setItem(`banner-dismissed-${name}`, banner);
                  setBannerDismissed(true);
                }}
                sx={{ fontSize: '1rem' }}
              >
                ×
              </IconButton>
            }
          >
            <AlertTitle>Tenant Notice</AlertTitle>
            {banner}
          </Alert>
        );
      })()}

      <Resource.DetailsGrid
        name={name}
        resourceType={Tenants}
        title={(<TenantHeaderTitle name={name} tenant={tenant} />) as any}
        extraInfo={item => {
          if (!item) return [];
          const extra = [
            {
              name: 'State',
              value: (
                <Chip
                  label={state}
                  color={state === 'Active' ? 'success' : 'warning'}
                  size="small"
                />
              ),
            },
            {
              name: 'Namespaces (from status)',
              value: <Typography component="span">{numNamespaces} namespace(s)</Typography>,
            },
            {
              name: 'Owners',
              value:
                owners.length > 0
                  ? owners.map((o: any, idx: number) => (
                      <Chip
                        key={idx}
                        size="small"
                        label={`${o.name} (${o.kind || 'User'})`}
                        sx={{ mr: 0.5, mb: 0.25 }}
                      />
                    ))
                  : '—',
            },
          ];
          if (namespaceQuota) {
            extra.push({
              name: 'Namespace quota',
              value: (
                <Chip
                  size="small"
                  color={namespaceQuota.remaining === 0 ? 'warning' : 'primary'}
                  label={`${namespaceQuota.used} / ${namespaceQuota.limit} namespaces`}
                />
              ),
            } as any);
          }
          const description =
            item.infoDescription ||
            item.jsonData?.metadata?.annotations?.['info.projectcapsule.dev/description'];
          if (description) {
            extra.push({
              name: 'Description',
              value: <Typography>{description}</Typography>,
            } as any);
          }

          return extra;
        }}
      >
        <DetailsSectionStack>
          <TenantLinks tenant={tenant} />

          <ConditionsAndEvents resource={tenant} />

          <TenantQuotaOverview tenant={tenant} />

          <TenantNamespacesOverview tenant={tenant} tenantNamespaces={tenantNamespaces} />

          <TenantPromotedServiceAccounts tenant={tenant} promotions={promotedServiceAccounts} />

          <SectionBox title="Scheduling and classes">
            {!hasClassConfiguration ? (
              <Typography color="text.secondary">
                No scheduling or class restrictions configured.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: 'minmax(0, 1fr)',
                    sm: 'repeat(2, minmax(0, 1fr))',
                  },
                }}
              >
                {tenant?.spec?.nodeSelector && (
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Node Selector
                    </Typography>
                    <Box
                      sx={{
                        p: 1,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        whiteSpace: 'pre',
                        overflow: 'auto',
                      }}
                    >
                      {JSON.stringify(tenant.spec.nodeSelector, null, 2)}
                    </Box>
                  </Box>
                )}
                {tenant?.spec?.storageClasses && (
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Allowed Storage Classes
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(
                        (tenant.spec.storageClasses as any).allowed ||
                        (Array.isArray(tenant.spec.storageClasses)
                          ? tenant.spec.storageClasses
                          : [])
                      ).map((sc: string, i: number) => (
                        <Chip key={i} label={sc} size="small" />
                      ))}
                      {(tenant.spec.storageClasses as any).allowedRegex && (
                        <Chip
                          label={`Regex: ${(tenant.spec.storageClasses as any).allowedRegex}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>
                )}
                {tenant?.spec?.ingressClasses && (
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Allowed Ingress Classes
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {((tenant.spec.ingressClasses as any).allowed || []).map(
                        (ic: string, i: number) => (
                          <Chip key={i} label={ic} size="small" />
                        )
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </SectionBox>
        </DetailsSectionStack>
      </Resource.DetailsGrid>
    </>
  );
}

function TenantPromotedServiceAccounts({
  tenant,
  promotions,
}: {
  tenant?: any;
  promotions: PromotedServiceAccount[];
}) {
  return (
    <SectionBox title="Promoted ServiceAccounts">
      <SimpleTable
        columns={[
          {
            label: 'ServiceAccount',
            getter: (promotion: PromotedServiceAccount) => (
              <Link
                routeName="serviceAccount"
                params={{ namespace: promotion.namespace, name: promotion.name }}
                activeCluster={tenant?.cluster}
              >
                {promotion.name}
              </Link>
            ),
          },
          {
            label: 'Namespace',
            getter: (promotion: PromotedServiceAccount) => (
              <Link
                routeName="namespace"
                params={{ name: promotion.namespace }}
                activeCluster={tenant?.cluster}
              >
                {promotion.namespace}
              </Link>
            ),
          },
          {
            label: 'Cluster Roles',
            getter: (promotion: PromotedServiceAccount) =>
              promotion.clusterRoles.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {promotion.clusterRoles.map(role => (
                    <Chip key={role} label={role} size="small" variant="outlined" />
                  ))}
                </Box>
              ) : (
                '—'
              ),
          },
          {
            label: 'Targets',
            getter: (promotion: PromotedServiceAccount) =>
              promotion.targets.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {promotion.targets.map(target => (
                    <Chip key={target} label={target} size="small" color="primary" />
                  ))}
                </Box>
              ) : (
                'All Tenant namespaces'
              ),
          },
        ]}
        data={promotions}
        emptyMessage="No ServiceAccounts are currently promoted according to Tenant status."
        reflectInURL={false}
      />
    </SectionBox>
  );
}

function TenantHeaderTitle({ name, tenant }: { name: string; tenant?: any }) {
  const icon = getTenantIcon(tenant);

  return (
    <Box component="span" sx={{ alignItems: 'center', display: 'inline-flex', gap: 1.25 }}>
      {icon &&
        (isImageRef(icon) ? (
          <Avatar
            component="span"
            src={safeUrl(icon)}
            alt=""
            sx={{ border: '1px solid', borderColor: 'divider', height: 38, width: 38 }}
          />
        ) : (
          <Box component="span" sx={{ alignItems: 'center', display: 'inline-flex' }}>
            <Icon icon={icon} width={36} height={36} />
          </Box>
        ))}
      <Box component="span">Tenant: {name}</Box>
    </Box>
  );
}

function TenantLinks({ tenant }: { tenant?: any }) {
  const links = getTenantLinks(tenant);
  if (links.length === 0) return null;

  return (
    <SectionBox title="Links">
      <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {links.map((link, index) => {
          const href = safeUrl(link.url);
          const linkIcon = link.icon;
          return (
            <Chip
              key={`${link.title || link.url}-${index}`}
              component={href ? 'a' : 'span'}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              clickable={!!href}
              label={link.title || link.url || 'Link'}
              icon={
                linkIcon ? (
                  isImageRef(linkIcon) ? (
                    <Avatar src={safeUrl(linkIcon)} alt="" />
                  ) : (
                    <Icon icon={linkIcon} />
                  )
                ) : (
                  <Icon icon="mdi:open-in-new" />
                )
              }
              variant="outlined"
            />
          );
        })}
      </Box>
    </SectionBox>
  );
}

function LabelsCell({ labels }: { labels: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  const labelEntries = Object.entries(labels);
  if (labelEntries.length === 0) return '—';
  const displayEntries = expanded ? labelEntries : labelEntries.slice(0, 2);
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.25,
        alignItems: 'center',
      }}
    >
      {displayEntries.map(([key, value], i) => (
        <Chip key={i} size="small" label={`${key}=${value}`} sx={{ fontSize: '0.65rem' }} />
      ))}
      {labelEntries.length > 2 && (
        <Chip
          size="small"
          label={expanded ? 'show less' : `+${labelEntries.length - 2} more`}
          onClick={e => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          clickable
          variant="outlined"
          sx={{ fontSize: '0.65rem', cursor: 'pointer' }}
        />
      )}
    </Box>
  );
}

function TenantNamespacesOverview({
  tenant,
  tenantNamespaces,
}: {
  tenant?: any;
  tenantNamespaces: any[];
}) {
  return (
    <SectionBox title="Namespaces">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2, sm: 2.5 },
          minWidth: 0,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {tenantNamespaces.length > 0 ? (
            <TenantNamespaceFlow tenant={tenant} namespaces={tenantNamespaces} />
          ) : (
            <Box
              sx={{
                alignItems: 'center',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                display: 'flex',
                justifyContent: 'center',
                minHeight: 300,
                p: 2,
              }}
            >
              <Typography color="text.secondary">No managed namespaces reported yet.</Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <ResourceListView
            id="capsule-tenant-namespaces"
            title={null}
            data={tenantNamespaces}
            defaultSortingColumn={{ id: 'name', desc: false }}
            headerProps={{ noNamespaceFilter: true }}
            reflectInURL={false}
            enableRowActions
            actions={[
              {
                id: 'cordon-namespace',
                action: ({ item, closeMenu }: any) => (
                  <NamespaceCordonAction item={item} closeMenu={closeMenu} buttonStyle="menu" />
                ),
              },
            ]}
            columns={[
              {
                id: 'name',
                label: 'Name',
                getValue: (item: any) => item.getName(),
                render: (item: any) => <NamespaceLink nsName={item.getName()} />,
              },
              {
                id: 'phase',
                label: 'Phase',
                getValue: (item: any) => item.jsonData?.status?.phase || 'Active',
                render: (item: any) => {
                  const phase = item.jsonData?.status?.phase || 'Active';
                  return (
                    <Chip
                      size="small"
                      label={phase}
                      color={phase === 'Active' ? 'success' : 'warning'}
                    />
                  );
                },
              },
              {
                id: 'ready-message',
                label: 'Ready Message',
                getValue: (item: any) => {
                  const nsName = item.getName();
                  const spaces = tenant?.status?.spaces || tenant?.jsonData?.status?.spaces || {};
                  let spaceInfo: any = null;
                  if (spaces && typeof spaces === 'object') {
                    if (spaces[nsName]) {
                      spaceInfo = spaces[nsName];
                    } else {
                      const arr = Array.isArray(spaces) ? spaces : Object.values(spaces);
                      spaceInfo = arr.find((s: any) => s && (s.name === nsName || s === nsName));
                    }
                  }
                  if (spaceInfo && spaceInfo.conditions?.length > 0) {
                    const cond =
                      spaceInfo.conditions.find(
                        (c: any) =>
                          c.type === 'Ready' ||
                          c.type?.includes('Ready') ||
                          c.type?.toLowerCase().includes('ready')
                      ) || spaceInfo.conditions[0];
                    return cond.message || cond.reason || cond.status || '—';
                  }
                  const conditions = item.jsonData?.status?.conditions || [];
                  if (conditions.length > 0) {
                    const ready =
                      conditions.find((c: any) => c.type?.toLowerCase().includes('ready')) ||
                      conditions[0];
                    return ready.message || ready.reason || ready.status || '—';
                  }
                  return item.jsonData?.status?.phase || '—';
                },
                render: (item: any) => {
                  const nsName = item.getName();
                  const spaces = tenant?.status?.spaces || tenant?.jsonData?.status?.spaces || {};
                  let spaceInfo: any = null;
                  if (spaces && typeof spaces === 'object') {
                    if (spaces[nsName]) {
                      spaceInfo = spaces[nsName];
                    } else {
                      const arr = Array.isArray(spaces) ? spaces : Object.values(spaces);
                      spaceInfo = arr.find((s: any) => s && (s.name === nsName || s === nsName));
                    }
                  }
                  if (spaceInfo?.conditions?.length) {
                    const cond =
                      spaceInfo.conditions.find(
                        (c: any) =>
                          c.type === 'Ready' ||
                          c.type?.includes('Ready') ||
                          c.type?.toLowerCase().includes('ready')
                      ) || spaceInfo.conditions[0];
                    const label =
                      cond.message || cond.reason || `${cond.type || 'Ready'}: ${cond.status}`;
                    return (
                      <Chip
                        size="small"
                        label={label}
                        color={cond.status === 'True' ? 'success' : 'default'}
                      />
                    );
                  }
                  const conditions = item.jsonData?.status?.conditions || [];
                  if (conditions.length > 0) {
                    const cond =
                      conditions.find((c: any) => c.type?.toLowerCase().includes('ready')) ||
                      conditions[0];
                    const label =
                      cond.message || cond.reason || `${cond.type || 'Ready'}: ${cond.status}`;
                    return (
                      <Chip
                        size="small"
                        label={label}
                        color={cond.status === 'True' ? 'success' : 'default'}
                      />
                    );
                  }
                  const phase = item.jsonData?.status?.phase || 'Active';
                  return (
                    <Chip
                      size="small"
                      label={phase}
                      color={phase === 'Active' ? 'success' : 'warning'}
                    />
                  );
                },
              },
              // {
              // 	id: "cordoned",
              // 	label: "Cordoned",
              // 	getValue: (item: any) => {
              // 		const l = item.jsonData?.metadata?.labels || {};
              // 		return l["projectcapsule.dev/cordoned"] === "true" ? "Yes" : "No";
              // 	},
              // 	render: (item: any) => {
              // 		const cord =
              // 			item.jsonData?.metadata?.labels?.[
              // 				"projectcapsule.dev/cordoned"
              // 			] === "true";
              // 		return (
              // 			<Chip
              // 				size="small"
              // 				label={cord ? "Cordoned" : "Active"}
              // 				color={cord ? "warning" : "success"}
              // 			/>
              // 		);
              // 	},
              // },
              {
                id: 'labels',
                label: 'Labels',
                getValue: (item: any) => {
                  const labels = item.jsonData?.metadata?.labels || {};
                  // Return a searchable string so the table filter/search works on label keys and values
                  return Object.entries(labels)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' ');
                },
                render: (item: any) => (
                  <LabelsCell labels={item.jsonData?.metadata?.labels || {}} />
                ),
              },
              'age',
            ]}
          />
        </Box>
      </Box>
    </SectionBox>
  );
}

function NamespaceLink({ nsName }: { nsName: string }) {
  const dispatch = useDispatch();

  const setNsFilter = useCallback(
    (namespaces: string[] | null) => {
      if (namespaces && namespaces.length > 0) {
        dispatch({ type: 'filter/setNamespaceFilter', payload: namespaces });
      } else {
        dispatch({ type: 'filter/setNamespaceFilter', payload: [] });
      }
    },
    [dispatch]
  );

  const handleClick = () => {
    // Also set the global filter (like the tenant selector does).
    // This ensures the UI is scoped to this ns (in addition to the navigation).
    setNsFilter([nsName]);
  };

  return (
    <Link routeName="namespace" params={{ name: nsName }} onClick={handleClick}>
      {nsName}
    </Link>
  );
}
