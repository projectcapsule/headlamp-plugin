import { isResourceReady } from '../../resources/tenantResources.helpers';
import { usagePercent } from '../../utils/quantity';

export interface ReadinessStats {
  ready: number;
  notReady: number;
  total: number;
}

export interface QuotaHealthStats {
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}

export interface ResourcePoolStats extends ReadinessStats {
  claims: number;
  exhausted: number;
}

export function countReadiness(items: any[] | null | undefined): ReadinessStats {
  const list = items || [];
  const ready = list.filter(item => isResourceReady(item)).length;
  return { ready, notReady: list.length - ready, total: list.length };
}

export function countQuotaHealth(items: any[] | null | undefined): QuotaHealthStats {
  let healthy = 0;
  let warning = 0;
  let critical = 0;

  (items || []).forEach(item => {
    const spec = item?.spec || item?.jsonData?.spec;
    const status = item?.status || item?.jsonData?.status;
    const percentage = usagePercent(status?.usage?.used, spec?.limit);
    if (percentage > 90) critical++;
    else if (percentage > 70) warning++;
    else healthy++;
  });

  return { healthy, warning, critical, total: (items || []).length };
}

export function countResourcePools(items: any[] | null | undefined): ResourcePoolStats {
  const readiness = countReadiness(items);
  let claims = 0;
  let exhausted = 0;

  (items || []).forEach(item => {
    const status = item?.status || item?.jsonData?.status || {};
    claims += Number(status.claimCount) || 0;
    if (
      (status.conditions || []).some(
        (condition: any) =>
          condition?.type === 'Exhausted' &&
          (condition.status === 'True' || condition.status === true)
      )
    ) {
      exhausted++;
    }
  });

  return { ...readiness, claims, exhausted };
}
