import { Icon } from '@iconify/react';
import { alpha, Avatar, Box, Button, Divider, Tab, Tabs } from '@mui/material';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Tenants } from '../../resources/tenants';
import {
  getTenantLinkIcon,
  isIconifyRef,
  isImageRef,
  normalizeIconRef,
  safeUrl,
} from '../../utils/tenantMeta';
import { TenantVisualIcon } from '../common/TenantVisualIcon';
import {
  getSelectedTenantContexts,
  readSelectedTenantNames,
  type TenantContextData,
} from './tenantContext';

function ContrastIconFrame({ children, size = 38 }: { children: ReactNode; size?: number }) {
  return (
    <Box
      component="span"
      sx={theme => {
        const accent = theme.palette.sidebar.selectedBackground;
        const accentText = theme.palette.getContrastText(accent);
        return {
          alignItems: 'center',
          bgcolor: accent,
          border: '1px solid',
          borderColor: alpha(accentText, 0.32),
          borderRadius: 1,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.22)',
          color: accentText,
          display: 'inline-flex',
          flex: `0 0 ${size}px`,
          height: size,
          justifyContent: 'center',
          width: size,
        };
      }}
    >
      {children}
    </Box>
  );
}

function AnnotationIcon({ value, size }: { value?: string; size: number }) {
  const normalized = normalizeIconRef(value);
  if (!normalized) return null;
  if (isImageRef(normalized)) {
    return (
      <Avatar
        alt=""
        src={safeUrl(normalized)}
        variant="rounded"
        sx={{ height: size, width: size }}
      />
    );
  }
  if (isIconifyRef(normalized)) {
    return <Icon aria-hidden icon={normalized} style={{ fontSize: size }} />;
  }
  return null;
}

function TenantLinks({ tenant }: { tenant: TenantContextData }) {
  const links = tenant.links.flatMap((link, index) => {
    const href = safeUrl(link.url);
    return href
      ? [
          {
            ...link,
            href,
            iconRef: getTenantLinkIcon(link),
            key: `${link.title || href}-${index}`,
          },
        ]
      : [];
  });

  if (links.length === 0) return null;

  return (
    <Box
      aria-label={`${tenant.name} links`}
      sx={{
        alignItems: 'center',
        borderColor: 'divider',
        borderTop: { xs: '1px solid', md: 0 },
        display: 'flex',
        flex: { xs: '0 0 auto', md: '1 1 auto' },
        minHeight: 62,
        minWidth: 0,
        overflowX: 'auto',
        px: { xs: 1, md: 1.5 },
        scrollbarWidth: 'thin',
        width: { xs: '100%', md: 'auto' },
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          gap: 0.5,
          marginLeft: 0,
          minWidth: 'max-content',
        }}
      >
        {links.map(link => (
          <Button
            aria-label={`${link.title || link.href} (opens in a new tab)`}
            component="a"
            href={link.href}
            key={link.key}
            rel="noopener noreferrer"
            size="small"
            startIcon={
              <ContrastIconFrame size={36}>
                {link.iconRef ? (
                  <AnnotationIcon size={26} value={link.iconRef} />
                ) : (
                  <Icon aria-hidden icon="mdi:open-in-new" width={25} height={25} />
                )}
              </ContrastIconFrame>
            }
            sx={{
              flexShrink: 0,
              minHeight: 48,
              textTransform: 'none',
              whiteSpace: 'nowrap',
            }}
            target="_blank"
            variant="text"
          >
            {link.title || link.href}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

/**
 * A secondary context row below Headlamp's app bar. The empty selection means
 * "No Tenant Filter" and intentionally renders nothing. Specific selections become
 * tabs, with the active Tenant's annotation-driven links alongside them.
 */
export function TenantLinksBar() {
  const [tenants] = Tenants.useList();
  const [selectedNames, setSelectedNames] = useState<string[]>(() =>
    readSelectedTenantNames(window.localStorage)
  );
  const [activeTenantName, setActiveTenantName] = useState<string>('');

  useEffect(() => {
    const update = () => setSelectedNames(readSelectedTenantNames(window.localStorage));
    window.addEventListener('storage', update);
    window.addEventListener('tenantSelectionChanged', update as EventListener);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('tenantSelectionChanged', update as EventListener);
    };
  }, []);

  const selectedTenants = useMemo(
    () => getSelectedTenantContexts(tenants, selectedNames),
    [tenants, selectedNames]
  );
  const activeTenant =
    selectedTenants.find(tenant => tenant.name === activeTenantName) || selectedTenants[0];

  if (!activeTenant) return null;

  const activeTenantHasLinks = activeTenant.links.some(link => !!safeUrl(link.url));

  return (
    <Box
      aria-label="Selected Tenant contexts"
      component="nav"
      sx={{
        // Headlamp renders top-side panels immediately before its AppBar in a
        // column flex layout. Give the adjacent AppBar an earlier flex order so
        // this contextual row sits directly beneath it instead of above it.
        '& + .MuiAppBar-root': { order: -1 },
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        boxShadow: theme => `0 1px 2px ${theme.palette.action.disabledBackground}`,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        flexShrink: 0,
        minHeight: 62,
        width: '100%',
      }}
    >
      <Tabs
        aria-label="Selected Tenants"
        onChange={(_event, value: string) => setActiveTenantName(value)}
        scrollButtons="auto"
        sx={{
          flexShrink: 0,
          minHeight: 62,
          maxWidth: { xs: '100%', md: '52%' },
          '& .MuiTabs-indicator': { height: 3 },
        }}
        value={activeTenant.name}
        variant="scrollable"
      >
        {selectedTenants.map(tenant => (
          <Tab
            icon={
              <ContrastIconFrame>
                <TenantVisualIcon icon={tenant.icon} size={30} />
              </ContrastIconFrame>
            }
            iconPosition="start"
            key={tenant.name}
            label={tenant.name}
            sx={{
              gap: 0.75,
              minHeight: 62,
              minWidth: 0,
              px: 1.5,
              py: 0.5,
              textTransform: 'none',
            }}
            value={tenant.name}
          />
        ))}
      </Tabs>
      {activeTenantHasLinks && (
        <>
          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />
          <TenantLinks tenant={activeTenant} />
        </>
      )}
    </Box>
  );
}
