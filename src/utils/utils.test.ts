import { describe, expect, it } from 'vitest';
import { parseKubernetesQuantity, usageChipColor, usageHex, usagePercent } from './quantity';
import {
  getLinkFaviconUrl,
  getTenantIcon,
  getTenantLinkIcon,
  getTenantLinks,
  isImageRef,
  normalizeFontAwesomeRef,
  normalizeIconRef,
  normalizeTenantLinks,
  safeUrl,
} from './tenantMeta';
import { findSpaceInfo, getTenantSpaceNames, getTenantSpaces, isSpaceReady } from './tenantSpaces';

describe('parseKubernetesQuantity', () => {
  it('handles empty/zero/nullish', () => {
    expect(parseKubernetesQuantity(undefined)).toBe(0);
    expect(parseKubernetesQuantity(null)).toBe(0);
    expect(parseKubernetesQuantity('')).toBe(0);
    expect(parseKubernetesQuantity('0')).toBe(0);
  });

  it('parses milli CPU', () => {
    expect(parseKubernetesQuantity('500m')).toBeCloseTo(0.5);
    expect(parseKubernetesQuantity('2')).toBe(2);
  });

  it('parses binary suffixes', () => {
    expect(parseKubernetesQuantity('1Ki')).toBe(1024);
    expect(parseKubernetesQuantity('1Mi')).toBe(1024 ** 2);
    expect(parseKubernetesQuantity('2Gi')).toBe(2 * 1024 ** 3);
  });

  it('parses decimal suffixes', () => {
    expect(parseKubernetesQuantity('1k')).toBe(1000);
    expect(parseKubernetesQuantity('1M')).toBe(1000 ** 2);
  });

  it('parses exponent and bare numbers', () => {
    expect(parseKubernetesQuantity('1e3')).toBe(1000);
    expect(parseKubernetesQuantity(42)).toBe(42);
  });

  it('falls back to numeric part for unknown suffix', () => {
    expect(parseKubernetesQuantity('5foo')).toBe(5);
  });
});

describe('usage helpers', () => {
  it('computes a percentage', () => {
    expect(usagePercent('500m', '1')).toBeCloseTo(50);
    expect(usagePercent('2Gi', '4Gi')).toBeCloseTo(50);
  });

  it('does not divide by zero', () => {
    expect(usagePercent('1', '0')).toBeCloseTo(100);
  });

  it('maps percentages to colors', () => {
    expect(usageHex(10)).toBe('#4caf50');
    expect(usageHex(80)).toBe('#ff9800');
    expect(usageHex(95)).toBe('#f44336');
    expect(usageChipColor(10)).toBe('success');
    expect(usageChipColor(80)).toBe('warning');
    expect(usageChipColor(95)).toBe('error');
  });
});

describe('safeUrl', () => {
  it('allows http/https/mailto and relative refs', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeUrl('/foo/bar')).toBe('/foo/bar');
    expect(safeUrl('#anchor')).toBe('#anchor');
  });

  it('rejects dangerous schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,<script>')).toBeUndefined();
    expect(safeUrl('vbscript:msgbox')).toBeUndefined();
  });

  it('handles empty/nullish', () => {
    expect(safeUrl(undefined)).toBeUndefined();
    expect(safeUrl('')).toBeUndefined();
    expect(safeUrl('   ')).toBeUndefined();
  });
});

describe('isImageRef', () => {
  it('treats safe http(s)/relative as image refs', () => {
    expect(isImageRef('https://x/y.png')).toBe(true);
    expect(isImageRef('/logo.svg')).toBe(true);
  });

  it('rejects iconify names and dangerous schemes', () => {
    expect(isImageRef('mdi:home')).toBe(false);
    expect(isImageRef('javascript:alert(1)')).toBe(false);
    expect(isImageRef('mailto:a@b.com')).toBe(false);
  });
});

describe('tenant annotation links', () => {
  it('supports native Iconify and common Font Awesome class references', () => {
    expect(normalizeIconRef('fa6-solid:chart-line')).toBe('fa6-solid:chart-line');
    expect(normalizeFontAwesomeRef('fa-solid fa-chart-line')).toBe('fa6-solid:chart-line');
    expect(normalizeFontAwesomeRef('fas fa-chart-line fa-fw')).toBe('fa-solid:chart-line');
    expect(normalizeFontAwesomeRef('fa-regular fa-file-lines')).toBe('fa6-regular:file-lines');
    expect(normalizeFontAwesomeRef('fab fa-github')).toBe('fa-brands:github');
    expect(normalizeFontAwesomeRef('fa-house')).toBe('fa6-solid:house');
    expect(
      getTenantIcon({
        metadata: {
          annotations: { 'info.projectcapsule.dev/icon': 'fa-solid fa-building' },
        },
      })
    ).toBe('fa6-solid:building');
  });

  it('preserves an independent Iconify name or image URL for every link', () => {
    const links = getTenantLinks({
      metadata: {
        annotations: {
          'info.projectcapsule.dev/links': JSON.stringify([
            {
              title: 'Grafana',
              url: 'https://grafana.example.com',
              icon: 'mdi:grafana',
            },
            {
              title: 'Runbook',
              url: 'https://docs.example.com',
              icon: 'https://docs.example.com/icon.svg',
            },
          ]),
        },
      },
    });

    expect(links).toEqual([
      {
        title: 'Grafana',
        url: 'https://grafana.example.com',
        icon: 'mdi:grafana',
      },
      {
        title: 'Runbook',
        url: 'https://docs.example.com',
        icon: 'https://docs.example.com/icon.svg',
      },
    ]);
  });

  it('normalizes fields and drops malformed link entries', () => {
    expect(
      normalizeTenantLinks([
        null,
        'bad',
        { title: '  Dashboard  ', url: ' /dashboard ', icon: ' mdi:view-dashboard ' },
        { icon: 'mdi:help' },
      ])
    ).toEqual([{ title: 'Dashboard', url: '/dashboard', icon: 'mdi:view-dashboard' }]);
  });

  it('resolves derived, explicit, and icon-keyword favicons', () => {
    expect(getLinkFaviconUrl('https://grafana.example.com/d/tenant?view=1')).toBe(
      'https://grafana.example.com/favicon.ico'
    );
    expect(
      getTenantLinkIcon({
        title: 'Grafana',
        url: 'https://grafana.example.com/d/tenant',
        favicon: true,
      })
    ).toBe('https://grafana.example.com/favicon.ico');
    expect(
      getTenantLinkIcon({
        title: 'Runbook',
        url: 'https://wiki.example.com',
        favicon: 'https://cdn.example.com/runbook.ico',
      })
    ).toBe('https://cdn.example.com/runbook.ico');
    expect(
      getTenantLinkIcon({
        title: 'Dashboard',
        url: 'https://example.com/dashboard',
        icon: 'favicon',
      })
    ).toBe('https://example.com/favicon.ico');
  });

  it('prefers a valid explicit icon and rejects unsafe favicon references', () => {
    expect(
      getTenantLinkIcon({
        url: 'https://example.com',
        icon: 'mdi:view-dashboard',
        favicon: true,
      })
    ).toBe('mdi:view-dashboard');
    expect(
      getTenantLinkIcon({
        url: 'https://example.com',
        icon: 'fa-solid fa-arrow-up-right-from-square',
      })
    ).toBe('fa6-solid:arrow-up-right-from-square');
    expect(
      getTenantLinkIcon({
        url: 'mailto:owner@example.com',
        favicon: 'javascript:alert(1)',
      })
    ).toBeUndefined();
  });
});

describe('tenantSpaces', () => {
  const tenantMap = {
    status: {
      spaces: {
        ns1: { conditions: [{ type: 'Ready', status: 'True' }] },
        ns2: { conditions: [{ type: 'Ready', status: 'False' }] },
      },
    },
  };
  const tenantArray = {
    status: {
      spaces: [{ name: 'ns1', conditions: [{ type: 'Ready', status: 'True' }] }, 'ns3'],
    },
  };

  it('normalizes map-shaped spaces', () => {
    expect(getTenantSpaceNames(tenantMap).sort()).toEqual(['ns1', 'ns2']);
    expect(getTenantSpaces(tenantMap)).toHaveLength(2);
  });

  it('normalizes array-shaped spaces incl. bare strings', () => {
    expect(getTenantSpaceNames(tenantArray).sort()).toEqual(['ns1', 'ns3']);
  });

  it('finds a space and reports readiness', () => {
    expect(isSpaceReady(findSpaceInfo(tenantMap, 'ns1'))).toBe(true);
    expect(isSpaceReady(findSpaceInfo(tenantMap, 'ns2'))).toBe(false);
    expect(isSpaceReady(findSpaceInfo(tenantMap, 'missing'))).toBe(false);
  });
});
