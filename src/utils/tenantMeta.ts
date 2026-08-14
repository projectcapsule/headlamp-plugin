import type { Tenants } from '../resources/tenants';

/**
 * Shared helpers for reading Capsule tenant "info" annotations and for safely
 * rendering the user-controlled values they contain (links, icons, banners).
 *
 * These were previously duplicated across TenantBox, TenantList, TenantDetail
 * and the Tenant context panel with subtly different fallback chains.
 */

export interface TenantLink {
  title?: string;
  url?: string;
  icon?: string;
}

/** Anything we may receive for a tenant: a Tenants KubeObject or a plain object. */
export type TenantLike =
  | Tenants
  | {
      infoIcon?: string;
      infoDescription?: string;
      infoBanner?: string;
      infoLinks?: TenantLink[];
      annotations?: Record<string, string>;
      metadata?: { annotations?: Record<string, string> };
      jsonData?: { metadata?: { annotations?: Record<string, string> } };
    }
  | null
  | undefined;

const ICON_KEY = 'info.projectcapsule.dev/icon';
const DESCRIPTION_KEY = 'info.projectcapsule.dev/description';
const LINKS_KEY = 'info.projectcapsule.dev/links';
const BANNER_KEY = 'info.projectcapsule.dev/banner';

const SAFE_SCHEMES = ['http', 'https', 'mailto'];

/**
 * Returns the URL only if it uses a safe scheme (http/https/mailto) or is a
 * relative/anchor reference. Rejects `javascript:`, `data:`, `vbscript:` etc.
 * to prevent stored-XSS via tenant annotations.
 */
export function safeUrl(url: string | undefined | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) {
    // No scheme: relative path or anchor — safe.
    return trimmed;
  }
  return SAFE_SCHEMES.includes(schemeMatch[1].toLowerCase()) ? trimmed : undefined;
}

/**
 * True when an icon reference is a safe image URL (http/https/relative)
 * rather than an iconify name. Uses safeUrl so javascript:/data:/vbscript:
 * etc. are never considered image refs.
 */
export function isImageRef(icon: string | undefined | null): boolean {
  const safe = safeUrl(icon);
  if (!safe) return false;
  return !safe.toLowerCase().startsWith('mailto:');
}

function getAnnotation(tenant: TenantLike, key: string): string | undefined {
  if (!tenant) return undefined;
  const t = tenant as Record<string, any>;
  return (
    t.jsonData?.metadata?.annotations?.[key] ??
    t.annotations?.[key] ??
    t.metadata?.annotations?.[key]
  );
}

export function getTenantIcon(tenant: TenantLike): string | undefined {
  if (!tenant) return undefined;
  return (tenant as any).infoIcon || getAnnotation(tenant, ICON_KEY);
}

export function getTenantDescription(tenant: TenantLike): string | undefined {
  if (!tenant) return undefined;
  return (tenant as any).infoDescription || getAnnotation(tenant, DESCRIPTION_KEY);
}

export function getTenantBanner(tenant: TenantLike): string | undefined {
  if (!tenant) return undefined;
  return (tenant as any).infoBanner || getAnnotation(tenant, BANNER_KEY);
}

/** Parses and returns the tenant quick-links, tolerating malformed JSON. */
export function getTenantLinks(tenant: TenantLike): TenantLink[] {
  if (!tenant) return [];
  const existing = (tenant as any).infoLinks;
  if (Array.isArray(existing)) return existing;
  const str = getAnnotation(tenant, LINKS_KEY);
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
