import { Icon } from '@iconify/react';
import { ApiProxy, K8s } from '@kinvolk/headlamp-plugin/lib';
import { Link, ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { DateLabel, SimpleTable } from '@kinvolk/headlamp-plugin/lib/components/common';
import type { KubeObject, KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/lib/k8s/cluster';
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import {
  getAppliedObjectsForTable,
  getManagedObjectReadyStatus,
  getManagedObjectStatusMessage,
  getPlural,
  type ReplicationDependency,
} from '../../resources/tenantResources';
import { AnchoredSectionBox as SectionBox } from './AnchoredSectionBox';
import { ManagedResourceFlow, managedResourceKey } from './ManagedResourceFlow';
import { anchoredResourceListHeaderProps, AnchoredSubheading } from './SectionAnchor';
import {
  buildSSAFieldLines,
  type ManagedFieldSelection,
  mergeSSAFields,
  selectReplicationManagedFields,
} from './ssaDiff';

function parseTarget(entry: any): {
  group: string;
  version: string;
  kind: string;
  name: string;
  namespace?: string;
  apiVersion: string;
} {
  const apiVersion = entry?.apiVersion || 'v1';
  const slash = apiVersion.indexOf('/');
  const group = slash > 0 ? apiVersion.substring(0, slash) : '';
  const version = slash > 0 ? apiVersion.substring(slash + 1) : apiVersion;
  return {
    group,
    version,
    kind: entry?.kind || '',
    name: entry?.name || '',
    namespace: entry?.namespace || undefined,
    apiVersion,
  };
}

function inventoryNameLink(item: KubeObject) {
  if (!item?.metadata?.creationTimestamp) return item?.metadata?.name || '';

  const kind = item.kind;
  const json: KubeObjectInterface = item.jsonData || (item as any);
  const apiVersion: string = json?.apiVersion || (item as any)?.apiVersion || 'v1';
  const slashIndex = apiVersion.lastIndexOf('/');
  const groupName = slashIndex > 0 ? apiVersion.substring(0, slashIndex) : apiVersion;
  const pluralName = getPlural(kind);

  if (kind === 'CustomResourceDefinition') {
    return (
      <Link routeName="crd" params={{ name: item.metadata.name }}>
        {item.metadata.name}
      </Link>
    );
  }

  const resourceKind = (K8s as any).ResourceClasses?.[kind];
  if (resourceKind) {
    try {
      const resource = new resourceKind(item.jsonData || item);
      if (resource?.getDetailsLink?.()) {
        return <Link kubeObject={resource}>{item.metadata.name}</Link>;
      }
    } catch {
      // Fall through to a plain name if the runtime class rejects the object.
    }
    return item.metadata.name;
  }

  return (
    <Link
      routeName="customresource"
      params={{
        crName: item.metadata.name,
        crd: `${pluralName}.${groupName}`,
        namespace: item.metadata.namespace || '-',
      }}
    >
      {item.metadata.name}
    </Link>
  );
}

/** Fetches the live KubeObjects represented by Capsule's applied inventory. */
export function useFetchedResources(applied: any[]): KubeObject[] {
  const [resources, setResources] = React.useState<KubeObject[]>([]);

  React.useEffect(() => {
    let active = true;
    setResources([]);

    const addResource = (resource: KubeObject) => {
      if (!active) return;
      setResources(previous => {
        const key = managedResourceKey(resource);
        return previous.some(item => managedResourceKey(item) === key)
          ? previous
          : [...previous, resource];
      });
    };

    (applied || []).forEach((entry: any) => {
      const target = parseTarget(entry);
      if (!target.kind || !target.name) return;

      const builtIn = (K8s as any).ResourceClasses?.[target.kind];
      const fetchResource = (resourceClass: any) => {
        resourceClass.apiGet(
          (data: KubeObject) => addResource(data),
          target.name,
          target.namespace,
          () => {
            const stub: any = {
              metadata: {
                name: target.name,
                namespace: target.namespace,
                uid: `${target.apiVersion}/${target.kind}/${target.namespace || ''}/${target.name}`,
              },
              kind: target.kind,
              apiVersion: target.apiVersion,
            };
            addResource(stub as KubeObject);
          }
        )();
      };

      if (builtIn) {
        fetchResource(builtIn);
      } else {
        fetchResource(
          makeCustomResourceClass({
            kind: target.kind,
            apiInfo: [{ group: target.group, version: target.version }],
            isNamespaced: !!target.namespace,
            singularName: target.kind.toLowerCase(),
            pluralName: getPlural(target.kind),
          })
        );
      }
    });

    return () => {
      active = false;
    };
  }, [applied]);

  return resources;
}

function ManagedResourcesTable({
  applied,
  resources,
  onInspect,
  tableId,
}: {
  applied: any[];
  resources: KubeObject[];
  onInspect: (item: KubeObject) => void;
  tableId: string;
}) {
  return (
    <ResourceListView
      title="Managed resource inventory"
      id={tableId}
      data={resources}
      defaultSortingColumn={{ id: 'name', desc: false }}
      enableRowActions={false}
      enableRowSelection={false}
      reflectInURL={false}
      headerProps={anchoredResourceListHeaderProps('Managed resource inventory', {
        headerProps: { noNamespaceFilter: true },
      })}
      columns={[
        {
          id: 'name',
          label: 'Name',
          getValue: (item: KubeObject) => item?.metadata?.name || '',
          render: (item: KubeObject) => inventoryNameLink(item),
        },
        {
          id: 'namespace',
          label: 'Namespace',
          getValue: (item: KubeObject) => item?.metadata?.namespace || '',
          filterVariant: 'select',
        },
        {
          id: 'kind',
          label: 'Kind',
          getValue: (item: KubeObject) => item?.kind || '',
          filterVariant: 'select',
        },
        {
          id: 'ready',
          label: 'Ready',
          getValue: (item: KubeObject) => getManagedObjectReadyStatus(item, applied).label,
          render: (item: KubeObject) => {
            const statusInfo = getManagedObjectReadyStatus(item, applied);
            const color =
              statusInfo.color === 'success'
                ? 'success'
                : statusInfo.color === 'error'
                ? 'error'
                : statusInfo.color === 'warning'
                ? 'warning'
                : 'default';
            return <Chip label={statusInfo.label} color={color} size="small" />;
          },
          filterVariant: 'select',
        },
        {
          id: 'message',
          label: 'Message',
          getValue: (item: KubeObject) => getManagedObjectStatusMessage(item, applied) || '',
          render: (item: KubeObject) => (
            <Typography
              variant="body2"
              color={
                getManagedObjectReadyStatus(item, applied).color === 'error'
                  ? 'error.main'
                  : 'text.secondary'
              }
              sx={{ maxWidth: 420, minWidth: 180, whiteSpace: 'normal' }}
            >
              {getManagedObjectStatusMessage(item, applied) || '—'}
            </Typography>
          ),
        },
        {
          id: 'age',
          label: 'Age',
          getValue: (item: KubeObject) => item?.metadata?.creationTimestamp || '',
          render: (item: KubeObject) => {
            const timestamp = item?.metadata?.creationTimestamp;
            return timestamp ? <DateLabel date={timestamp} /> : '';
          },
        },
        {
          id: 'ssa-diff',
          label: 'SSA Diff',
          getValue: () => '',
          render: (item: KubeObject) => (
            <Button
              size="small"
              variant="text"
              startIcon={<Icon icon="mdi:file-compare" />}
              onClick={() => onInspect(item)}
            >
              Inspect
            </Button>
          ),
          sort: false,
          disableFiltering: true,
        },
      ]}
    />
  );
}

export interface GetResourcesFromAppliedProps {
  applied: any[];
  extraColumns?: any[];
}

/** Backwards-compatible table wrapper retained for other plugin consumers. */
export function GetResourcesFromApplied({ applied, extraColumns }: GetResourcesFromAppliedProps) {
  const resources = useFetchedResources(applied);
  const baseColumns = [
    { label: 'Name', getter: (item: KubeObject) => inventoryNameLink(item) },
    { label: 'Namespace', getter: (item: KubeObject) => item?.metadata?.namespace || '' },
    { label: 'Kind', getter: (item: KubeObject) => item?.kind || '' },
    {
      label: 'Ready',
      getter: (item: KubeObject) => {
        const statusInfo = getManagedObjectReadyStatus(item, applied);
        return <Chip label={statusInfo.label} color={statusInfo.color} size="small" />;
      },
    },
    {
      label: 'Message',
      getter: (item: KubeObject) => getManagedObjectStatusMessage(item, applied) || '—',
    },
    {
      label: 'Age',
      getter: (item: KubeObject) => {
        const timestamp = item?.metadata?.creationTimestamp;
        return timestamp ? <DateLabel date={timestamp} /> : '';
      },
    },
  ];

  return (
    <SimpleTable
      columns={[...baseColumns, ...(extraColumns || [])]}
      data={resources}
      emptyMessage="No managed resources."
      reflectInURL={false}
    />
  );
}

function SSADiffPanel({
  selected,
  fetchedObject,
  managedFields,
  fetchError,
  onClose,
}: {
  selected: any;
  fetchedObject: any;
  managedFields: ManagedFieldSelection[];
  fetchError: string | null;
  onClose: () => void;
}) {
  const combinedFields = React.useMemo(
    () => mergeSSAFields(...managedFields.map(field => field.fieldsV1)),
    [managedFields]
  );
  const lines = React.useMemo(
    () =>
      fetchedObject && combinedFields ? buildSSAFieldLines(fetchedObject, combinedFields) : [],
    [fetchedObject, combinedFields]
  );
  const namespace = selected?.namespace || selected?.metadata?.namespace;
  const name = selected?.name || selected?.metadata?.name;
  const kind = selected?.kind || selected?.jsonData?.kind;

  return (
    <Paper variant="outlined" sx={{ mt: 2, overflow: 'hidden', borderRadius: 2 }}>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}
      >
        <Icon icon="mdi:file-compare" width={24} height={24} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <AnchoredSubheading title="SSA Diff" variant="subtitle1" sx={{ fontWeight: 600 }} />
          <Typography variant="body2" color="text.secondary" noWrap>
            {kind} · {namespace ? `${namespace}/` : ''}
            {name}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ maxWidth: '45%', overflow: 'auto' }}>
          {managedFields.map(field => (
            <Tooltip
              key={`${field.manager}-${field.operation}`}
              title={`Field manager: ${field.manager}`}
            >
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={field.manager}
                sx={{ maxWidth: 260 }}
              />
            </Tooltip>
          ))}
        </Stack>
        <Tooltip title="Close SSA diff">
          <IconButton aria-label="Close SSA diff" size="small" onClick={onClose}>
            <Icon icon="mdi:close" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Divider />

      <Box sx={{ p: 2 }}>
        {fetchError && <Alert severity="error">Error fetching object: {fetchError}</Alert>}
        {!fetchedObject && !fetchError && (
          <Stack direction="row" spacing={1.5} alignItems="center" color="text.secondary">
            <CircularProgress size={20} />
            <Typography variant="body2">Loading live object and SSA ownership…</Typography>
          </Stack>
        )}
        {fetchedObject && !combinedFields && (
          <Alert severity="info">
            This object has no server-side apply field set owned by the replication resource.
          </Alert>
        )}
        {lines.length > 0 && (
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" color="success" label="SSA-owned field" />
              <Typography variant="caption" color="text.secondary">
                Highlighted lines are owned by the generator or Capsule resource controller; the
                remaining lines are the current live-object context.
              </Typography>
              {managedFields.some(field => field.time) && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  Last changed{' '}
                  {new Date(
                    Math.max(
                      ...managedFields
                        .filter(field => field.time)
                        .map(field => new Date(field.time as string).getTime())
                    )
                  ).toLocaleString()}
                </Typography>
              )}
            </Stack>
            <Box
              component="pre"
              sx={theme => ({
                m: 0,
                py: 1,
                overflow: 'auto',
                maxHeight: 480,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.text.primary, 0.025),
                color: 'text.primary',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.78rem',
                lineHeight: 1.55,
              })}
            >
              {lines.map((line, index) => (
                <Box
                  component="span"
                  key={`${index}-${line.text}`}
                  sx={theme => ({
                    display: 'grid',
                    gridTemplateColumns: '3.5rem minmax(max-content, 1fr)',
                    px: 1.25,
                    color: line.managed ? 'success.dark' : 'text.primary',
                    bgcolor: line.managed ? alpha(theme.palette.success.main, 0.12) : 'transparent',
                    fontWeight: line.managed ? 600 : 400,
                  })}
                >
                  <Box component="span" sx={{ color: 'text.disabled', userSelect: 'none' }}>
                    {index + 1}
                  </Box>
                  <Box component="span">{line.text}</Box>
                </Box>
              ))}
            </Box>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

export interface ManagedResourcesProps {
  dependencies?: ReplicationDependency[];
  item?: any;
  title?: string;
}

export function ManagedResources({
  dependencies = [],
  item,
  title = 'Managed Resources',
}: ManagedResourcesProps) {
  const applied = React.useMemo(() => getAppliedObjectsForTable(item), [item]);
  const resources = useFetchedResources(applied);
  const [selected, setSelected] = React.useState<any>(null);
  const [fetchedObject, setFetchedObject] = React.useState<any>(null);
  const [managedFields, setManagedFields] = React.useState<ManagedFieldSelection[]>([]);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!selected) {
      setFetchedObject(null);
      setManagedFields([]);
      setFetchError(null);
      return () => {
        active = false;
      };
    }

    setFetchError(null);
    setFetchedObject(null);
    setManagedFields([]);

    const apiVersion = selected.apiVersion || selected.jsonData?.apiVersion || 'v1';
    const kind = selected.kind || selected.jsonData?.kind;
    const objectName = selected.name || selected.metadata?.name;
    const objectNamespace = selected.namespace || selected.metadata?.namespace;
    const prefix =
      apiVersion === 'v1' || !apiVersion.includes('/') ? '/api/v1' : `/apis/${apiVersion}`;
    const plural = getPlural(kind);
    const url = `${prefix}${
      objectNamespace ? `/namespaces/${objectNamespace}` : ''
    }/${plural}/${objectName}`;

    ApiProxy.request(url)
      .then((object: any) => {
        if (!active) return;
        setFetchedObject(object);
        const managedFields: ManagedFieldSelection[] = object?.metadata?.managedFields || [];
        setManagedFields(selectReplicationManagedFields(managedFields));
      })
      .catch((error: any) => {
        if (active) setFetchError(error?.message || String(error));
      });

    return () => {
      active = false;
    };
  }, [selected]);

  const clearSelection = () => setSelected(null);
  const selectedKey = selected ? managedResourceKey(selected) : undefined;

  if ((!applied || applied.length === 0) && dependencies.length === 0) {
    return (
      <SectionBox title={title}>
        <Typography color="text.secondary">No managed resources reported yet.</Typography>
      </SectionBox>
    );
  }

  return (
    <>
      <SectionBox title={title}>
        <ManagedResourceFlow
          item={item}
          applied={applied}
          resources={resources}
          selectedKey={selectedKey}
          dependencies={dependencies}
          onSelect={setSelected}
        />

        {selected && (
          <SSADiffPanel
            selected={selected}
            fetchedObject={fetchedObject}
            managedFields={managedFields}
            fetchError={fetchError}
            onClose={clearSelection}
          />
        )}
      </SectionBox>
      {applied.length > 0 && (
        <ManagedResourcesTable
          applied={applied}
          resources={resources}
          onInspect={setSelected}
          tableId={`capsule-${String(item?.kind || item?.jsonData?.kind || 'replication-resource')
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .toLowerCase()}-managed-inventory`}
        />
      )}
    </>
  );
}

export default ManagedResources;
