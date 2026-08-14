import { describe, expect, it } from 'vitest';
import { visibleStatChips, visibleStatSegments } from './statCardVisibility';

describe('stat card visibility', () => {
  it('omits zero-value chart segments', () => {
    expect(
      visibleStatSegments([
        { name: 'Ready', value: 4, color: 'green' },
        { name: 'Not Ready', value: 0, color: 'red' },
      ])
    ).toEqual([{ name: 'Ready', value: 4, color: 'green' }]);
  });

  it('omits zero-value chips while preserving non-count labels', () => {
    expect(
      visibleStatChips([
        { label: '4 Ready', color: 'success' },
        { label: '0 Not Ready', color: 'error' },
        { label: 'Healthy', color: 'success' },
      ]).map(chip => chip.label)
    ).toEqual(['4 Ready', 'Healthy']);
  });
});
