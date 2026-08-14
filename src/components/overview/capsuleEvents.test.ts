import { describe, expect, it } from 'vitest';
import { capsuleEventTimestamp, isCapsuleResourceEvent } from './capsuleEventHelpers';

describe('Capsule overview events', () => {
  it('selects events whose involved object belongs to the Capsule API group', () => {
    expect(
      isCapsuleResourceEvent({ involvedObject: { apiVersion: 'capsule.clastix.io/v1beta2' } })
    ).toBe(true);
    expect(
      isCapsuleResourceEvent({
        jsonData: { involvedObject: { apiVersion: 'capsule.clastix.io/v1beta1' } },
      })
    ).toBe(true);
    expect(isCapsuleResourceEvent({ involvedObject: { apiVersion: 'apps/v1' } })).toBe(false);
  });

  it('uses the newest available event timestamp representation', () => {
    expect(
      capsuleEventTimestamp({
        lastOccurrence: '2026-08-13T10:00:00Z',
        jsonData: { lastTimestamp: '2026-08-13T09:00:00Z' },
      })
    ).toBe('2026-08-13T10:00:00Z');
    expect(
      capsuleEventTimestamp({ jsonData: { series: { lastObservedTime: '2026-08-13T11:00:00Z' } } })
    ).toBe('2026-08-13T11:00:00Z');
  });
});
