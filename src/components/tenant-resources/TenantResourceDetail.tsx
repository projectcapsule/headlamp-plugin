import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { Link, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Resource, { SimpleTable } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Box, Chip, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  getAppliedCount,
  getDefinedReplicationEntries,
  getPlural,
  getReplicationDependencies,
  getSpecResourcesCount,
  TenantResource,
} from '../../resources/tenantResources';
import { ConditionsAndEvents } from '../common/ConditionsAndEvents';
import { DetailsSectionStack } from '../common/DetailsSectionStack';
import { ManagedResources } from '../common/ManagedResources';
import { REPLICATION_RESOURCE_REFRESH_EVENT } from '../common/replicationCordon';
import { ReplicationDependenciesSection } from '../common/ReplicationDependencies';

export interface TenantResourceDetailProps {
  name?: string;
  namespace?: string;
}

export function TenantResourceDetail(props: TenantResourceDetailProps) {
  const params = useParams<{ namespace: string; name: string }>();
  const { name = params.name, namespace = params.namespace } = props;

  const [list, listError] = TenantResource.useList();
  const listedTenantResourceItem = useMemo(
    () =>
      list?.find(
        (q: any) => q.getName() === name && (!namespace || q.getNamespace() === namespace)
      ),
    [list, name, namespace]
  );
  const [actionRefreshedItem, setActionRefreshedItem] = useState<any>();

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (
        detail?.kind === 'TenantResource' &&
        detail.name === name &&
        (!namespace || detail.namespace === namespace)
      ) {
        setActionRefreshedItem(new TenantResource(detail.data));
      }
    };
    window.addEventListener(REPLICATION_RESOURCE_REFRESH_EVENT, handleRefresh);
    return () => window.removeEventListener(REPLICATION_RESOURCE_REFRESH_EVENT, handleRefresh);
  }, [name, namespace]);

  const tenantResourceItem = useMemo(() => {
    if (!actionRefreshedItem) return listedTenantResourceItem;
    if (!listedTenantResourceItem) return actionRefreshedItem;
    const listedVersion = BigInt(listedTenantResourceItem.metadata?.resourceVersion || 0);
    const refreshedVersion = BigInt(actionRefreshedItem.metadata?.resourceVersion || 0);
    return listedVersion > refreshedVersion ? listedTenantResourceItem : actionRefreshedItem;
  }, [actionRefreshedItem, listedTenantResourceItem]);
  const dependencies = useMemo(
    () => getReplicationDependencies(tenantResourceItem, list || []),
    [tenantResourceItem, list]
  );

  return (
    <>
      {listError && (
        <Typography color="error" sx={{ mb: 2 }}>
          Error loading TenantResource: {listError.message || String(listError)}. Is the Capsule CRD
          present and do you have list permission?
        </Typography>
      )}

      <Resource.DetailsGrid
        name={name}
        namespace={namespace}
        resourceType={TenantResource}
        extraInfo={item => {
          if (!item) return [];
          const numSpecResources = getSpecResourcesCount(item);
          const numStatusResources = getAppliedCount(item);
          return [
            {
              name: 'Resource Rules',
              value: <Chip size="small" label={numSpecResources} />,
            },
            {
              name: 'Replicated Items',
              value: <Chip size="small" label={numStatusResources} />,
            },
            {
              name: 'Resync Period',
              value: (
                <Typography>
                  {item.spec?.resyncPeriod || item.jsonData?.spec?.resyncPeriod || '—'}
                </Typography>
              ),
            },
          ];
        }}
      >
        <DetailsSectionStack>
          <ConditionsAndEvents resource={tenantResourceItem} />
          <ReplicationDependenciesSection dependencies={dependencies} />
          <TenantResourceDefinedResources
            name={name}
            namespace={namespace}
            item={tenantResourceItem}
          />
          <ManagedResources
            item={tenantResourceItem}
            title="Managed Resources"
            dependencies={dependencies}
          />
        </DetailsSectionStack>
      </Resource.DetailsGrid>
    </>
  );
}
function TenantResourceDefinedResources({
  name,
  namespace,
  item: providedItem,
}: {
  name: string;
  namespace?: string;
  item?: any;
}) {
  const [list] = TenantResource.useList();
  const item =
    providedItem ||
    list?.find((q: any) => q.getName() === name && (!namespace || q.getNamespace() === namespace));
  const spec = item?.spec || item?.jsonData?.spec || {};
  const rules = spec.resources || [];
  const definedEntries: any[] = getDefinedReplicationEntries(rules);

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

  // Group by kind

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    definedEntries.forEach((r: any) => {
      const key = r.kind || 'Unknown';
      if (!g[key]) g[key] = [];
      g[key].push(r);
    });
    return g;
  }, [definedEntries]);

  if (definedEntries.length === 0) {
    return (
      <SectionBox title="Defined Resources">
        <Typography color="text.secondary">No resources defined in spec.</Typography>
      </SectionBox>
    );
  }

  return (
    <SectionBox title="Defined Resources">
      {Object.entries(grouped).map(([kind, kindResources], index, entries) => (
        <Box key={kind} sx={{ mb: index === entries.length - 1 ? 0 : 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 500 }}>
            {kind} ({kindResources.length})
          </Typography>
          <SimpleTable
            columns={[
              {
                label: 'Name',
                getter: (r: any) => {
                  const display = r.name || '—';
                  if (
                    !r.name ||
                    !r.kind ||
                    r.kind === 'Generator' ||
                    r.kind === 'Rule' ||
                    r.kind === 'Raw'
                  ) {
                    return display;
                  }

                  const builtIn = (K8s as any).ResourceClasses?.[r.kind];
                  if (builtIn) {
                    try {
                      const synthetic = {
                        apiVersion: r.apiVersion || 'v1',
                        kind: r.kind,
                        metadata: {
                          name: r.name,
                          namespace: r.namespace || undefined,
                        },
                      };
                      const res = new builtIn(synthetic);
                      if (res?.getDetailsLink?.()) {
                        return <Link kubeObject={res}>{display}</Link>;
                      }
                    } catch {}
                    return display;
                  }

                  // Custom resource fallback
                  const apiVersion = r.apiVersion || 'v1';
                  const group = apiVersion.includes('/') ? apiVersion.split('/')[0] : '';
                  const plural = getPlural(r.kind);
                  return (
                    <Link
                      routeName="customresource"
                      params={{
                        crName: r.name,
                        crd: `${plural}.${group}`,
                        namespace: r.namespace || '-',
                      }}
                      onClick={() => {
                        if (r.namespace) setNsFilter([r.namespace]);
                      }}
                    >
                      {display}
                    </Link>
                  );
                },
              },
              {
                label: 'Namespace (source)',
                getter: (r: any) => r.namespace || '—',
              },
              {
                label: 'Selector',
                getter: (r: any) => {
                  if (r.selector) return JSON.stringify(r.selector);
                  if (r.labelSelector) return JSON.stringify(r.labelSelector);
                  if (r.fieldSelector) return r.fieldSelector;
                  return '—';
                },
              },
              {
                label: 'API Version',
                getter: (r: any) => r.apiVersion || 'v1',
              },
              {
                label: 'Sync Options',
                getter: (r: any) => (r.syncOptions ? 'force' : '—'),
              },
            ]}
            data={kindResources}
            emptyMessage="No defined entries for this kind."
            reflectInURL={false}
          />
        </Box>
      ))}
    </SectionBox>
  );
}
