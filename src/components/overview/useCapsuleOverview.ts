import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import { readSelectedTenantNames } from '../tenants/tenantContext';
import { type CollectionResult, overviewClient } from './overviewClient';
import { COLLECTIONS, RESOURCE_GROUPS } from './overviewRegistry';

function allowedNamespaces(cluster: string): string[] {
  try {
    const allowed = JSON.parse(
      localStorage.getItem(`cluster_settings.${cluster}`) || '{}'
    ).allowedNamespaces;
    return Array.isArray(allowed)
      ? allowed.filter(value => typeof value === 'string' && value)
      : [];
  } catch {
    return [];
  }
}
function subscribeTenants(changed: () => void) {
  window.addEventListener('tenantSelectionChanged', changed);
  window.addEventListener('storage', changed);
  return () => {
    window.removeEventListener('tenantSelectionChanged', changed);
    window.removeEventListener('storage', changed);
  };
}
const tenantSnapshot = () => JSON.stringify(readSelectedTenantNames(localStorage));

export function useCapsuleOverview() {
  const cluster = K8s.useCluster();
  const selectedClusters = K8s.useSelectedClusters();
  const namespaceSet = useSelector((state: any) => state.filter.namespaces);
  const namespaces: string[] = [...(namespaceSet || [])].sort();
  const selectedTenants: string[] = JSON.parse(
    useSyncExternalStore(subscribeTenants, tenantSnapshot)
  );
  const scopes = [...new Set(selectedClusters.length ? selectedClusters : cluster ? [cluster] : [])]
    .sort()
    .map(cluster => {
      const allowed = allowedNamespaces(cluster);
      const selected = namespaces.length ? namespaces : allowed;
      const scoped =
        allowed.length && namespaces.length
          ? selected.filter(value => allowed.includes(value))
          : selected;
      return {
        cluster,
        namespaces: scoped,
        controllerNamespaces: allowed,
        namespacedExcluded: !!namespaces.length && !!allowed.length && !scoped.length,
      };
    });
  const key = JSON.stringify(scopes);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string;
    results: Record<string, CollectionResult>;
    loading: boolean;
    updatedAt?: number;
  }>({ key: '', results: {}, loading: true });
  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setState(previous => ({
      key,
      results: previous.key === key ? previous.results : {},
      loading: true,
      updatedAt: previous.key === key ? previous.updatedAt : undefined,
    }));
    if (!scopes.length) {
      setState({
        key,
        results: Object.fromEntries(COLLECTIONS.map(spec => [spec.id, { items: [] }])),
        loading: false,
        updatedAt: Date.now(),
      });
      return () => abort.abort();
    }
    void overviewClient
      .run(
        COLLECTIONS,
        scopes,
        (id, result) => {
          if (!abort.signal.aborted)
            setState(previous => ({ ...previous, results: { ...previous.results, [id]: result } }));
        },
        abort.signal
      )
      .catch(error => {
        if (!abort.signal.aborted)
          setState(previous => ({
            ...previous,
            results: Object.fromEntries(
              COLLECTIONS.map(spec => [
                spec.id,
                previous.results[spec.id] || {
                  items: [],
                  error: { message: error.message || String(error) },
                },
              ])
            ),
          }));
      })
      .finally(() => {
        if (!abort.signal.aborted) {
          setState(previous => ({ ...previous, loading: false, updatedAt: Date.now() }));
          timer = setTimeout(() => setRevision(value => value + 1), 30000);
        }
      });
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
    // The serialized scope is stable when Redux or Headlamp recreates arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision]);
  const current = state.key === key ? state : { key, results: {}, loading: true };
  return {
    ...current,
    namespaces,
    selectedTenants,
    scopes,
    groups: RESOURCE_GROUPS.map(group => ({
      ...group,
      ...current.results[group.id],
      items: current.results[group.id]?.items ?? null,
    })),
    controllers: current.results.controllers?.items || [],
    controllerError: current.results.controllers?.error,
    events: current.results.events?.items || [],
    eventError: current.results.events?.error,
    refresh: () => setRevision(value => value + 1),
  };
}
