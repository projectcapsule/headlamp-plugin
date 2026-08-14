import { describe, expect, it } from 'vitest';
import {
  buildServiceAccountPromotionRequest,
  capsuleConfigurationAllowsServiceAccountPromotion,
  isServiceAccountPromoted,
  replaceServiceAccountData,
  SERVICE_ACCOUNT_PROMOTION_LABEL,
} from './serviceAccountPromotion';

describe('ServiceAccount owner promotion', () => {
  const serviceAccount = {
    kind: 'ServiceAccount',
    metadata: {
      name: 'robot/operator',
      namespace: 'solar test',
      labels: { [SERVICE_ACCOUNT_PROMOTION_LABEL]: 'true' },
    },
  };

  it('recognizes only the exact promotion label value', () => {
    expect(isServiceAccountPromoted(serviceAccount)).toBe(true);
    expect(
      isServiceAccountPromoted({
        metadata: { labels: { [SERVICE_ACCOUNT_PROMOTION_LABEL]: 'yes' } },
      })
    ).toBe(false);
  });

  it('requires the global Capsule admission switch to be explicitly enabled', () => {
    expect(
      capsuleConfigurationAllowsServiceAccountPromotion([
        { spec: { allowServiceAccountPromotion: false } },
        { jsonData: { spec: { allowServiceAccountPromotion: true } } },
      ])
    ).toBe(true);
    expect(capsuleConfigurationAllowsServiceAccountPromotion([])).toBe(false);
  });

  it('builds promotion and revocation merge patches', () => {
    expect(buildServiceAccountPromotionRequest(serviceAccount, true)).toEqual({
      body: { metadata: { labels: { [SERVICE_ACCOUNT_PROMOTION_LABEL]: 'true' } } },
      name: 'robot/operator',
      namespace: 'solar test',
      promote: true,
      url: '/api/v1/namespaces/solar%20test/serviceaccounts/robot%2Foperator',
    });
    expect(buildServiceAccountPromotionRequest(serviceAccount, false)?.body).toEqual({
      metadata: { labels: { [SERVICE_ACCOUNT_PROMOTION_LABEL]: null } },
    });
  });

  it('rejects resources which are not namespaced ServiceAccounts', () => {
    expect(
      buildServiceAccountPromotionRequest(
        { kind: 'ConfigMap', metadata: { name: 'settings', namespace: 'solar-test' } },
        true
      )
    ).toBeNull();
  });

  it('replaces KubeObject jsonData without assigning getter-only metadata', () => {
    const wrapper = { jsonData: serviceAccount };
    const refreshed = { ...serviceAccount, metadata: { ...serviceAccount.metadata, labels: {} } };
    replaceServiceAccountData(wrapper, refreshed);
    expect(wrapper.jsonData).toBe(refreshed);
  });
});
