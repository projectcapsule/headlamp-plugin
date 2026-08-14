import { Link, ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { DateLabel } from '@kinvolk/headlamp-plugin/lib/components/common';
import Event from '@kinvolk/headlamp-plugin/lib/k8s/event';
import { Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { capsuleEventTimestamp, isCapsuleResourceEvent } from './capsuleEventHelpers';

const resourceRoutes: Record<string, { routeName: string; namespaced: boolean }> = {
  Tenant: { routeName: 'tenant', namespaced: false },
  CustomQuota: { routeName: 'customquota', namespaced: true },
  GlobalCustomQuota: { routeName: 'globalcustomquota', namespaced: false },
  TenantResource: { routeName: 'tenantresource', namespaced: true },
  GlobalTenantResource: { routeName: 'globaltenantresource', namespaced: false },
};

const capsuleResourcePlurals: Record<string, string> = {
  GlobalResourceQuota: 'globalresourcequotas',
  ResourcePool: 'resourcepools',
  TenantOwner: 'tenantowners',
};

function involvedObject(event: any) {
  return event?.involvedObject || event?.jsonData?.involvedObject || {};
}

function eventResourceLink(event: any) {
  const object = involvedObject(event);
  const route = resourceRoutes[object.kind];
  const label = `${object.kind || 'Resource'}/${object.name || 'Unknown'}`;

  if (route) {
    return (
      <Link
        routeName={route.routeName}
        params={{
          name: object.name,
          ...(route.namespaced ? { namespace: object.namespace } : {}),
        }}
      >
        {label}
      </Link>
    );
  }

  const plural = capsuleResourcePlurals[object.kind];
  if (plural) {
    return (
      <Link
        routeName="customresource"
        params={{
          crName: object.name,
          crd: `${plural}.capsule.clastix.io`,
          namespace: object.namespace || '-',
        }}
      >
        {label}
      </Link>
    );
  }

  return label;
}

export function CapsuleEvents() {
  const [events, error] = Event.useList({ limit: 500 });
  const capsuleEvents = useMemo(() => (events || []).filter(isCapsuleResourceEvent), [events]);

  return (
    <ResourceListView
      id="capsule-overview-events"
      title="Capsule Events"
      data={capsuleEvents}
      defaultSortingColumn={{ id: 'last-occurrence', desc: true }}
      enableRowActions={false}
      enableRowSelection={false}
      errorMessage={error ? error.message || String(error) : null}
      reflectInURL={false}
      headerProps={{ noNamespaceFilter: true }}
      columns={[
        {
          id: 'type',
          label: 'Type',
          getValue: (event: any) => event.type || event.jsonData?.type || '',
          render: (event: any) => {
            const type = event.type || event.jsonData?.type || 'Unknown';
            return (
              <Chip size="small" label={type} color={type === 'Warning' ? 'warning' : 'info'} />
            );
          },
          filterVariant: 'select',
        },
        {
          id: 'resource',
          label: 'Resource',
          getValue: (event: any) => {
            const object = involvedObject(event);
            return `${object.kind || ''}/${object.name || ''}`;
          },
          render: eventResourceLink,
        },
        {
          id: 'namespace',
          label: 'Namespace',
          getValue: (event: any) => involvedObject(event).namespace || '—',
          filterVariant: 'select',
        },
        {
          id: 'reason',
          label: 'Reason',
          getValue: (event: any) => event.reason || event.jsonData?.reason || '—',
          filterVariant: 'select',
        },
        {
          id: 'message',
          label: 'Message',
          getValue: (event: any) => event.message || event.jsonData?.message || '',
          render: (event: any) => (
            <Typography variant="body2" sx={{ maxWidth: 520, minWidth: 220, whiteSpace: 'normal' }}>
              {event.message || event.jsonData?.message || '—'}
            </Typography>
          ),
        },
        {
          id: 'count',
          label: 'Count',
          getValue: (event: any) => Number(event.count || event.jsonData?.count || 1),
        },
        {
          id: 'last-occurrence',
          label: 'Last Occurrence',
          getValue: capsuleEventTimestamp,
          render: (event: any) => {
            const timestamp = capsuleEventTimestamp(event);
            return timestamp ? <DateLabel date={timestamp} /> : '—';
          },
        },
      ]}
    />
  );
}

export default CapsuleEvents;
