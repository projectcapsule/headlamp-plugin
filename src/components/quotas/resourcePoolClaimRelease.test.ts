import { describe, expect, it } from 'vitest';
import {
  buildResourcePoolClaimReleaseRequest,
  canReleaseResourcePoolClaim,
  RESOURCE_POOL_CLAIM_RELEASE_ANNOTATION,
} from './resourcePoolClaimRelease';

function claim(bound: string) {
  return {
    kind: 'ResourcePoolClaim',
    metadata: { name: 'cpu', namespace: 'solar-test' },
    status: { conditions: [{ status: bound, type: 'Bound' }] },
  };
}

describe('ResourcePoolClaim release', () => {
  it('builds the upstream release annotation request only for Bound=False', () => {
    expect(canReleaseResourcePoolClaim(claim('False'))).toBe(true);
    expect(buildResourcePoolClaimReleaseRequest(claim('False'))).toEqual({
      body: {
        metadata: {
          annotations: { [RESOURCE_POOL_CLAIM_RELEASE_ANNOTATION]: 'true' },
        },
      },
      name: 'cpu',
      namespace: 'solar-test',
      url: '/apis/capsule.clastix.io/v1beta2/namespaces/solar-test/resourcepoolclaims/cpu',
    });
  });

  it('does not offer release while the claim is bound', () => {
    expect(canReleaseResourcePoolClaim(claim('True'))).toBe(false);
    expect(buildResourcePoolClaimReleaseRequest(claim('True'))).toBeNull();
  });
});
