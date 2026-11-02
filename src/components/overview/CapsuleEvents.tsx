import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { DateLabel } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { anchoredResourceListHeaderProps } from '../common/SectionAnchor';
import { capsuleEventTimestamp, isCapsuleResourceEvent } from './capsuleEventHelpers';

function involvedObject(event: any) {
  return event?.involvedObject || event?.jsonData?.involvedObject || {};
}

function eventResourceLink(event: any) {
  const object = involvedObject(event);
  const label = `${object.kind || 'Resource'}/${object.name || 'Unknown'}`;
  const crd = CAPSULE_CRDS[object.kind as keyof typeof CAPSULE_CRDS];
  return crd && object.name ? (
    <CapsuleResourceLink
      crd={crd}
      name={object.name}
      namespace={object.namespace}
      cluster={event.cluster}
    >
      {label}
    </CapsuleResourceLink>
  ) : (
    label
  );
}

export function CapsuleEvents({ events, error }: { events: any[]; error?: { message: string } }) {
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
      headerProps={anchoredResourceListHeaderProps('Capsule Events', {
        headerProps: { noNamespaceFilter: true },
      })}
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
