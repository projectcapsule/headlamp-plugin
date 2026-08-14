import { Chip } from '@mui/material';

export type ConditionChipColor = 'success' | 'error' | 'warning' | 'info' | 'default';

export function conditionStatusColor(status: unknown, conditionType?: string): ConditionChipColor {
  const normalized = String(status ?? '').toLowerCase();
  if (conditionType?.toLowerCase() === 'cordoned') {
    if (normalized === 'true') return 'warning';
    return 'default';
  }
  if (conditionType?.toLowerCase() === 'exhausted') {
    if (normalized === 'true') return 'error';
    if (normalized === 'false') return 'info';
    return 'default';
  }
  if (conditionType?.toLowerCase() === 'bound') {
    if (normalized === 'true' || normalized === 'false') return 'info';
    return 'default';
  }
  if (normalized === 'true') return 'success';
  if (normalized === 'false') return 'error';
  if (normalized === 'unknown') return 'warning';
  return 'default';
}

export function ConditionStatusChip({ status, type }: { status: unknown; type?: string }) {
  return (
    <Chip
      label={String(status ?? 'Unknown')}
      color={conditionStatusColor(status, type)}
      size="small"
    />
  );
}

export default ConditionStatusChip;
