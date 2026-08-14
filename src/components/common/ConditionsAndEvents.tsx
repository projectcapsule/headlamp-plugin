import { SectionBox, SimpleTable } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import type { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import Event from '@kinvolk/headlamp-plugin/lib/k8s/event';
import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ConditionStatusChip } from './ConditionStatusChip';

export interface ConditionsAndEventsProps {
  resource?: KubeObject | null;
}

/** Keeps a Capsule resource's Conditions and Events together in the detail flow. */
export function ConditionsAndEvents({ resource }: ConditionsAndEventsProps) {
  const conditions = resource?.jsonData?.status?.conditions || [];

  return (
    <Box
      sx={{
        alignItems: 'start',
        display: 'grid',
        gap: { xs: 2, sm: 3 },
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          xl: 'repeat(2, minmax(0, 1fr))',
        },
        mb: 3,
        minWidth: 0,
        '& > *': { mb: '0 !important', minWidth: 0 },
      }}
    >
      <SectionBox title="Conditions">
        {conditions.length === 0 ? (
          <Typography color="text.secondary">No conditions.</Typography>
        ) : (
          <SimpleTable
            columns={[
              { label: 'Type', getter: (condition: any) => condition.type },
              {
                label: 'Status',
                getter: (condition: any) => (
                  <ConditionStatusChip status={condition.status} type={condition.type} />
                ),
              },
              { label: 'Reason', getter: (condition: any) => condition.reason || '—' },
              { label: 'Message', getter: (condition: any) => condition.message || '—' },
              {
                label: 'Last Transition',
                getter: (condition: any) =>
                  condition.lastTransitionTime
                    ? new Date(condition.lastTransitionTime).toLocaleString()
                    : '—',
              },
            ]}
            data={conditions}
            emptyMessage="No conditions."
            reflectInURL={false}
          />
        )}
      </SectionBox>

      <ResourceEvents resource={resource} />
    </Box>
  );
}

function ResourceEvents({ resource }: ConditionsAndEventsProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState('');
  const resourceKey = resource
    ? `${resource.cluster || ''}/${resource.metadata?.uid || resource.metadata?.name || ''}`
    : '';

  useEffect(() => {
    let active = true;
    setEvents([]);
    setError('');
    if (!resource) return () => undefined;

    Event.objectEvents(resource)
      .then(items => {
        if (active) setEvents(items.map((item: any) => new Event(item, resource.cluster)));
      })
      .catch(fetchError => {
        if (active) setError(fetchError?.message || String(fetchError));
      });

    return () => {
      active = false;
    };
  }, [resourceKey]);

  return (
    <SectionBox title="Events">
      {error ? (
        <Typography color="error">Unable to load events: {error}</Typography>
      ) : (
        <SimpleTable
          columns={[
            { label: 'Type', getter: (event: Event) => event.type || '—' },
            { label: 'Reason', getter: (event: Event) => event.reason || '—' },
            {
              label: 'From',
              getter: (event: Event) =>
                event.source?.component || event.jsonData?.reportingController || '—',
            },
            { label: 'Message', getter: (event: Event) => event.message || '—' },
            {
              label: 'Last Occurrence',
              getter: (event: Event) =>
                event.lastOccurrence ? new Date(event.lastOccurrence).toLocaleString() : '—',
              sort: (event: Event) =>
                event.lastOccurrence ? new Date(event.lastOccurrence).getTime() : 0,
            },
          ]}
          data={events}
          defaultSortingColumn={-5}
          emptyMessage={resource ? 'No events.' : 'Loading events…'}
          reflectInURL={false}
        />
      )}
    </SectionBox>
  );
}

export default ConditionsAndEvents;
