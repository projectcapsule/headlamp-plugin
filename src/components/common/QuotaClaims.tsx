import { Router } from '@kinvolk/headlamp-plugin/lib';
import { Link, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { SimpleTable } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { Cell, Pie, PieChart } from 'recharts';
import type { CustomQuota, GlobalCustomQuota } from '../../resources/customQuotas';
import {
  parseKubernetesQuantity,
  usageChipColor,
  usageHex,
  usagePercent,
} from '../../utils/quantity';

type QuotaClaim = NonNullable<NonNullable<CustomQuota['status']>['claims']>[number];

export function QuotaClaims({
  quota,
  cluster,
}: {
  quota?: CustomQuota | GlobalCustomQuota;
  cluster?: string;
}) {
  const claims: QuotaClaim[] = quota?.status?.claims || [];
  const limit = quota?.spec?.limit || '0';
  const used = quota?.status?.usage?.used || '0';
  const usedVal = parseKubernetesQuantity(used);
  const limitVal = parseKubernetesQuantity(limit) || 1;
  const overallPct = usagePercent(used, limit);

  if (claims.length === 0) {
    return (
      <SectionBox title="Claims">
        <Typography color="text.secondary">No claims yet.</Typography>
      </SectionBox>
    );
  }

  // Group claims by resource kind for separate tables (based on preferred GlobalCustomQuota implementation)
  const grouped: Record<string, QuotaClaim[]> = {};
  claims.forEach(claim => {
    const key = claim.kind || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(claim);
  });

  return (
    <SectionBox title="Claims">
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography>
          Overall usage: {used} / {limit} ({overallPct.toFixed(1)}%)
        </Typography>
        <Tooltip title="Pie: total claims usage vs limit (green &lt;70%, orange 70-90%, red &gt;90%)">
          <Box>
            {(() => {
              const pieData = [
                {
                  name: 'Used',
                  value: usedVal,
                  fill: usageHex(overallPct),
                },
                {
                  name: 'Remaining',
                  value: Math.max(0, limitVal - usedVal),
                  fill: '#e0e0e0',
                },
              ];
              return (
                <PieChart width={60} height={60}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={18}
                    outerRadius={28}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              );
            })()}
          </Box>
        </Tooltip>
      </Box>
      {Object.entries(grouped).map(([kind, kindClaims], index, entries) => (
        <Box key={kind} sx={{ mb: index === entries.length - 1 ? 0 : 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 500 }}>
            {kind} ({kindClaims.length})
          </Typography>
          <SimpleTable
            columns={[
              {
                label: 'Name',
                getter: (c: QuotaClaim) => {
                  const p = {
                    name: c.name,
                    ...(c.namespace ? { namespace: c.namespace } : {}),
                  };
                  const routeUrl =
                    Router.createRouteURL(c.kind, p) ||
                    (c.namespace ? `/namespaces/${c.namespace}` : '/');
                  return (
                    <Link
                      to={routeUrl}
                      routeName={c.kind}
                      params={p}
                      activeCluster={cluster}
                      tooltip
                    >
                      {c.name}
                    </Link>
                  );
                },
              },
              {
                label: 'Namespace',
                getter: (c: QuotaClaim) => c.namespace || '—',
              },
              {
                label: 'Usage',
                getter: (c: QuotaClaim) => c.usage || '—',
              },
              {
                label: '% of Limit',
                getter: (c: QuotaClaim) => {
                  const u = parseKubernetesQuantity(c.usage || '0');
                  const p = limitVal > 0 ? Math.min(100, Math.max(0, (u / limitVal) * 100)) : 0;
                  return <Chip label={`${p.toFixed(0)}%`} color={usageChipColor(p)} size="small" />;
                },
              },
            ]}
            data={kindClaims}
            emptyMessage="No claims for this resource type."
            reflectInURL={false}
          />
        </Box>
      ))}
    </SectionBox>
  );
}
