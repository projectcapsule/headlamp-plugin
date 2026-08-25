import { Box, Tooltip, Typography } from '@mui/material';
import { Cell, Pie, PieChart } from 'recharts';
import { parseKubernetesQuantity, usageHex, usagePercent } from '../../utils/quantity';

interface QuotaUsageProps {
  used?: string;
  limit?: string;
  size?: number; // for pie
}

export function QuotaUsage({ used = '0', limit = '0', size = 20 }: QuotaUsageProps) {
  const uVal = parseKubernetesQuantity(used);
  const lVal = parseKubernetesQuantity(limit) || 1;
  const p = usagePercent(used, limit);
  const color = usageHex(p);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2">{used}</Typography>
      <Tooltip title={`${p.toFixed(1)}% of limit (green <85%, orange 85% to <95%, red >=95%)`}>
        <Box>
          {(() => {
            const pieData = [
              { name: 'Used', value: uVal, fill: color },
              {
                name: 'Remaining',
                value: Math.max(0, lVal - uVal),
                fill: '#e0e0e0',
              },
            ];
            return (
              <PieChart width={size} height={size}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={size / 3}
                  outerRadius={size / 2}
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
  );
}
