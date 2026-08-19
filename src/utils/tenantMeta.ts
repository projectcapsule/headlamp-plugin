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
  /** Iconify/Font Awesome name or classes, or a safe image URL. */
  icon?: string;
  /** Derive /favicon.ico from the link origin, or use this explicit favicon URL. */
  favicon?: boolean | string;
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
const ICONIFY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const FONT_AWESOME_STYLES: Record<string, string> = {
  fa: 'fa',
  fas: 'fa-solid',
  far: 'fa-regular',
  fab: 'fa-brands',
  'fa-solid': 'fa6-solid',
  'fa-regular': 'fa6-regular',
  'fa-brands': 'fa6-brands',
};
const FONT_AWESOME_MODIFIER =
  /^fa-(?:xs|sm|lg|xl|\d+x|fw|ul|li|border|pull-left|pull-right|spin|pulse|beat|fade|beat-fade|bounce|flip|shake|rotate-\d+|flip-(?:horizontal|vertical|both)|inverse|stack|stack-1x|stack-2x|classic)$/;

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

export function isIconifyRef(icon: string | undefined | null): boolean {
  return typeof icon === 'string' && ICONIFY_NAME.test(icon.trim());
}

/** Converts common Font Awesome CSS classes to their Iconify collection name. */
export function normalizeFontAwesomeRef(icon: string | undefined | null): string | undefined {
  if (!icon || typeof icon !== 'string') return undefined;
  const tokens = icon.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return undefined;

  const styleToken = tokens.find(token => token in FONT_AWESOME_STYLES);
  const iconToken = tokens.find(
    token =>
      /^fa-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(token) &&
      !(token in FONT_AWESOME_STYLES) &&
      !FONT_AWESOME_MODIFIER.test(token)
  );
  if (!iconToken) return undefined;

  const collection = styleToken ? FONT_AWESOME_STYLES[styleToken] : 'fa6-solid';
  return `${collection}:${iconToken.slice(3)}`;
}

/** Normalizes image, Iconify, and Font Awesome class references for rendering. */
export function normalizeIconRef(icon: string | undefined | null): string | undefined {
  if (!icon || typeof icon !== 'string') return undefined;
  const trimmed = icon.trim();
  if (!trimmed) return undefined;
  if (isIconifyRef(trimmed)) return trimmed;

  const fontAwesome = normalizeFontAwesomeRef(trimmed);
  if (fontAwesome) return fontAwesome;
  if (/^(?:fa|fas|far|fab)(?:\s|$)|^fa-/.test(trimmed.toLowerCase())) return undefined;

  return isImageRef(trimmed) ? trimmed : undefined;
}

/** Returns the conventional origin favicon for an absolute HTTP(S) link. */
export function getLinkFaviconUrl(url: string | undefined | null): string | undefined {
  const safe = safeUrl(url);
  if (!safe) return undefined;
  try {
    const parsed = new URL(safe);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

/** Resolves the safe visual reference for one individual annotated link. */
export function getTenantLinkIcon(link: TenantLink): string | undefined {
  const icon = link.icon?.trim();
  if (icon && icon.toLowerCase() !== 'favicon') {
    const normalized = normalizeIconRef(icon);
    if (normalized) return normalized;
  }

  const favicon = typeof link.favicon === 'string' ? link.favicon.trim() : link.favicon;
  if (typeof favicon === 'string' && isImageRef(favicon)) return favicon;
  if (favicon === true || icon?.toLowerCase() === 'favicon') {
    return getLinkFaviconUrl(link.url);
  }
  return undefined;
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
  return normalizeIconRef((tenant as any).infoIcon || getAnnotation(tenant, ICON_KEY));
}

export function getTenantDescription(tenant: TenantLike): string | undefined {
  if (!tenant) return undefined;
  return (tenant as any).infoDescription || getAnnotation(tenant, DESCRIPTION_KEY);
}

export function getTenantBanner(tenant: TenantLike): string | undefined {
  if (!tenant) return undefined;
  return (tenant as any).infoBanner || getAnnotation(tenant, BANNER_KEY);
}

/**
 * Normalizes annotation JSON into link objects. Each entry owns its icon so a
 * Tenant can mix Iconify names and image URLs across its individual links.
 */
export function normalizeTenantLinks(value: unknown): TenantLink[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : undefined;
    const url = typeof candidate.url === 'string' ? candidate.url.trim() : undefined;
    const icon = typeof candidate.icon === 'string' ? candidate.icon.trim() : undefined;
    const favicon =
      candidate.favicon === true
        ? true
        : typeof candidate.favicon === 'string'
        ? candidate.favicon.trim()
        : undefined;

    if (!title && !url) return [];
    return [
      {
        ...(title ? { title } : {}),
        ...(url ? { url } : {}),
        ...(icon ? { icon } : {}),
        ...(favicon ? { favicon } : {}),
      },
    ];
  });
}

/** Parses and returns the tenant quick-links, tolerating malformed JSON. */
export function getTenantLinks(tenant: TenantLike): TenantLink[] {
  if (!tenant) return [];
  const existing = (tenant as any).infoLinks;
  if (Array.isArray(existing)) return normalizeTenantLinks(existing);
  const str = getAnnotation(tenant, LINKS_KEY);
  if (!str) return [];
  try {
    return normalizeTenantLinks(JSON.parse(str));
  } catch {
    return [];
  }
}
