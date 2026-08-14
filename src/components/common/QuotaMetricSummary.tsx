import { Box, Stack, Typography } from '@mui/material';
import { usageHex } from '../../utils/quantity';
import type { QuotaAggregationMetric } from './quotaAggregation';

export function QuotaMetricSummary({ metrics }: { metrics: QuotaAggregationMetric[] }) {
  if (metrics.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No usage reported
      </Typography>
    );
  }

  return (
    <Stack spacing={0.5} sx={{ minWidth: 220, py: 0.5 }}>
      {metrics.map(metric => (
        <Box
          key={metric.resource}
          sx={{
            alignItems: 'center',
            display: 'grid',
            gap: 1,
            gridTemplateColumns: '92px minmax(68px, 1fr)',
          }}
        >
          <Box
            sx={{ alignItems: 'center', display: 'flex', gap: 0.6, minWidth: 0 }}
            title={`${metric.resource}: ${metric.percent.toFixed(1)}% used`}
          >
            <Box
              sx={{
                bgcolor: usageHex(metric.percent),
                borderRadius: '50%',
                flex: '0 0 auto',
                height: 8,
                width: 8,
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap>
              {metric.resource}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            noWrap
            sx={{ fontWeight: 650, justifySelf: 'start', minWidth: 0 }}
          >
            {metric.used} / {metric.hard}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

export default QuotaMetricSummary;
