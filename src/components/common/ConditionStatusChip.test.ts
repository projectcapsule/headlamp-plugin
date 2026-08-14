import { describe, expect, it } from 'vitest';
import { conditionStatusColor } from './ConditionStatusChip';

describe('conditionStatusColor', () => {
  it.each([
    ['True', 'success'],
    [true, 'success'],
    ['False', 'error'],
    [false, 'error'],
    ['Unknown', 'warning'],
    [undefined, 'default'],
  ])('maps %s to %s', (status, color) => {
    expect(conditionStatusColor(status)).toBe(color);
  });

  it('uses gray for Cordoned=False and yellow for Cordoned=True', () => {
    expect(conditionStatusColor('False', 'Cordoned')).toBe('default');
    expect(conditionStatusColor(false, 'Cordoned')).toBe('default');
    expect(conditionStatusColor('True', 'Cordoned')).toBe('warning');
    expect(conditionStatusColor(true, 'Cordoned')).toBe('warning');
  });

  it('uses red for Exhausted=True and blue for Exhausted=False', () => {
    expect(conditionStatusColor('False', 'Exhausted')).toBe('info');
    expect(conditionStatusColor('True', 'Exhausted')).toBe('error');
  });

  it('uses blue for Bound state instead of treating False as an error', () => {
    expect(conditionStatusColor('True', 'Bound')).toBe('info');
    expect(conditionStatusColor('False', 'Bound')).toBe('info');
  });
});
