import { getTenantIcon, getTenantLinks, type TenantLink } from '../../utils/tenantMeta';

export const TENANT_SELECTION_STORAGE_KEYS = [
  'selectedTenantNames',
  'selectedTenantName',
  'selectedTenant',
] as const;

export interface TenantContextData {
  name: string;
  icon?: string;
  links: TenantLink[];
}

/**
 * Parses both the current multi-select value and the legacy single-Tenant
 * values. An empty result deliberately means Headlamp is scoped to all
 * Tenants, in which case the contextual panel must stay hidden.
 */
export function parseStoredTenantSelection(saved: string | null | undefined): string[] {
  if (!saved) return [];

  let names: unknown[] = [];
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      names = parsed;
    } else if (typeof parsed === 'string') {
      names = [parsed];
    } else if (parsed?.metadata && typeof parsed.metadata.name === 'string') {
      names = [parsed.metadata.name];
    }
  } catch {
    if (!saved.startsWith('{') && !saved.startsWith('[')) {
      names = [saved.replace(/^"|"$/g, '')];
    }
  }

  return Array.from(
    new Set(names.filter((name): name is string => typeof name === 'string' && name.length > 0))
  );
}

export function readSelectedTenantNames(storage: Pick<Storage, 'getItem'>): string[] {
  for (const key of TENANT_SELECTION_STORAGE_KEYS) {
    const saved = storage.getItem(key);
    if (saved) return parseStoredTenantSelection(saved);
  }
  return [];
}

/**
 * Resolves selected Tenants in selector order rather than Kubernetes list
 * order, so the context tabs remain stable and predictable.
 */
export function getSelectedTenantContexts(
  tenants: any[] | null | undefined,
  selectedNames: string[]
): TenantContextData[] {
  if (!tenants || selectedNames.length === 0) return [];

  const tenantsByName = new Map<string, any>();
  tenants.forEach(tenant => {
    const name = tenant?.getName?.() || tenant?.metadata?.name;
    if (name) tenantsByName.set(name, tenant);
  });

  return selectedNames.flatMap(name => {
    const tenant = tenantsByName.get(name);
    if (!tenant) return [];
    return [
      {
        name,
        icon: getTenantIcon(tenant),
        links: getTenantLinks(tenant),
      },
    ];
  });
}
