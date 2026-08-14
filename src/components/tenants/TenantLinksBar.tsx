import { Icon } from '@iconify/react';
import { Avatar, Box, Button, Divider, Tab, Tabs } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Tenants } from '../../resources/tenants';
import { isImageRef, safeUrl } from '../../utils/tenantMeta';
import {
  getSelectedTenantContexts,
  readSelectedTenantNames,
  type TenantContextData,
} from './tenantContext';

const ICONIFY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function AnnotationIcon({ value, size }: { value?: string; size: number }) {
  if (!value) return null;
  if (isImageRef(value)) {
    return (
      <Avatar alt="" src={safeUrl(value)} variant="rounded" sx={{ height: size, width: size }} />
    );
  }
  if (ICONIFY_NAME.test(value)) {
    return <Icon aria-hidden icon={value} style={{ fontSize: size }} />;
  }
  return null;
}

function TenantLinks({ tenant }: { tenant: TenantContextData }) {
  const links = tenant.links.flatMap((link, index) => {
    const href = safeUrl(link.url);
    return href ? [{ ...link, href, key: `${link.title || href}-${index}` }] : [];
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
        minHeight: 42,
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
          marginLeft: 'auto',
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
              link.icon ? (
                <AnnotationIcon size={18} value={link.icon} />
              ) : (
                <Icon aria-hidden icon="mdi:open-in-new" />
              )
            }
            sx={{
              flexShrink: 0,
              minHeight: 30,
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
 * "All Tenants" and intentionally renders nothing. Specific selections become
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
        minHeight: 42,
        width: '100%',
      }}
    >
      <Tabs
        aria-label="Selected Tenants"
        onChange={(_event, value: string) => setActiveTenantName(value)}
        scrollButtons="auto"
        sx={{
          flexShrink: 0,
          minHeight: 42,
          maxWidth: { xs: '100%', md: '52%' },
          '& .MuiTabs-indicator': { height: 3 },
        }}
        value={activeTenant.name}
        variant="scrollable"
      >
        {selectedTenants.map(tenant => (
          <Tab
            icon={tenant.icon ? <AnnotationIcon size={20} value={tenant.icon} /> : undefined}
            iconPosition="start"
            key={tenant.name}
            label={tenant.name}
            sx={{
              gap: 0.75,
              minHeight: 42,
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
