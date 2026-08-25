import { SimpleTable } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Typography } from '@mui/material';
import { AnchoredSectionBox as SectionBox } from './AnchoredSectionBox';

export function QuotaSources({ quota }: { quota: any }) {
  const sources = quota?.spec?.sources || [];

  return (
    <SectionBox title="Sources">
      {sources.length === 0 ? (
        <Typography color="text.secondary">No sources defined.</Typography>
      ) : (
        <SimpleTable
          columns={[
            {
              label: 'Group',
              getter: s => s.group || 'core',
            },
            {
              label: 'Version',
              getter: s => s.version || 'v1',
            },
            {
              label: 'Kind',
              getter: s => s.kind,
            },
            {
              label: 'Operation',
              getter: s => s.op,
            },
            {
              label: 'Path',
              getter: s => s.path || '—',
            },
          ]}
          data={sources}
          emptyMessage="No sources defined."
          reflectInURL={false}
        />
      )}
    </SectionBox>
  );
}
