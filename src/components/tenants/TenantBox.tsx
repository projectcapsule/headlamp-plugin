import { Icon } from '@iconify/react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemIcon,
  ListItemText,
  Menu,
  Tooltip,
  Typography,
} from '@mui/material';
import { blue, green, red } from '@mui/material/colors';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Tenants } from '../../resources/tenants';
import { getTenantIcon } from '../../utils/tenantMeta';
import { TenantVisualIcon } from '../common/TenantVisualIcon';
import { tenantStateChipColor } from './tenantStatusHelpers';

interface TenantItem {
  metadata?: { name?: string };
  status?: {
    namespaces?: string[] | number;
    state?: string;
    size?: number;
    spaces?: any;
  };
  infoIcon?: string;
  infoDescription?: string;
  infoBanner?: string;
  annotations?: Record<string, any>;
}

export function TenantBox() {
  const [tenants, error] = Tenants.useList();
  // Store selected Tenant names. Empty means no Tenant/Namespace filter is active.
  const [selectedTenantNames, setSelectedTenantNames] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const theme = useTheme();
  const tenantAccent = theme.palette.sidebar.selectedBackground;
  const tenantAccentText = theme.palette.getContrastText(tenantAccent);
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();

  const dispatch = useDispatch();

  // Derive selected tenants array (live objects)
  const selectedTenants: any[] =
    selectedTenantNames.length > 0 && tenants
      ? tenants.filter((t: any) => selectedTenantNames.includes(t.metadata?.name || ''))
      : [];

  // Compute union of namespaces from all selected tenants (for the global filter)
  const selectedNamespaces =
    selectedTenantNames.length > 0 && tenants
      ? Array.from(
          new Set(
            selectedTenantNames.flatMap(name => {
              const t = tenants.find((t: any) => t.metadata?.name === name);
              return Array.isArray(t?.status?.namespaces) ? t.status.namespaces : [];
            })
          )
        )
      : null;

  // Scope the global namespace filter to the selected tenants' namespaces
  // (colocated from previous utils/namespace.tsx)
  const setNsFilter = useCallback(
    (namespaces: string[] | null) => {
      if (namespaces && namespaces.length > 0) {
        dispatch({ type: 'filter/setNamespaceFilter', payload: namespaces });
      } else {
        dispatch({ type: 'filter/setNamespaceFilter', payload: [] });
      }
    },
    [dispatch]
  );

  useEffect(() => {
    setNsFilter(selectedNamespaces as string[] | null);
  }, [setNsFilter, selectedNamespaces, selectedTenantNames]);

  useEffect(() => {
    // Support new array storage + legacy single name
    const saved =
      localStorage.getItem('selectedTenantNames') ||
      localStorage.getItem('selectedTenantName') ||
      localStorage.getItem('selectedTenant');
    let names: string[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          names = parsed.filter((n: any) => typeof n === 'string');
        } else if (typeof parsed === 'string') {
          names = [parsed];
        } else if (parsed?.metadata && typeof parsed.metadata.name === 'string') {
          names = [parsed.metadata.name];
          // migrate old
          localStorage.setItem('selectedTenantNames', JSON.stringify(names));
          localStorage.removeItem('selectedTenant');
          localStorage.removeItem('selectedTenantName');
        }
      } catch (_e) {
        if (saved && !saved.startsWith('{') && !saved.startsWith('[')) {
          names = [saved.replace(/^"|"$/g, '')];
        } else {
          localStorage.removeItem('selectedTenant');
          localStorage.removeItem('selectedTenantName');
          localStorage.removeItem('selectedTenantNames');
        }
      }
    }
    setSelectedTenantNames(names);
  }, [tenants]);

  // Persist selection (array)
  useEffect(() => {
    localStorage.setItem('selectedTenantNames', JSON.stringify(selectedTenantNames));
    // Notify other components (including the secondary Tenant context tabs) about the change.
    window.dispatchEvent(
      new CustomEvent('tenantSelectionChanged', {
        detail: selectedTenantNames,
      })
    );
  }, [selectedTenantNames]);

  if (error) {
    return (
      <Tooltip
        title={`Failed to load Tenants: ${
          error.message || error
        }. Check that Capsule is installed and you have access.`}
      >
        <Button variant="contained" color="primary" disabled size="small">
          Tenants (error)
        </Button>
      </Tooltip>
    );
  }
  if (!tenants) {
    return (
      <Button variant="contained" color="primary" disabled size="small">
        Loading...
      </Button>
    );
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (isSmall) {
      setOpenDialog(true);
    } else {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleToggle = (tenant: TenantItem) => {
    const name = tenant?.metadata?.name ? tenant.metadata.name : null;
    if (!name) return;

    const wasSelected = selectedTenantNames.includes(name);
    setSelectedTenantNames(prev => {
      if (prev.includes(name)) {
        return prev.filter(n => n !== name);
      }
      return [...prev, name];
    });

    // When choosing (selecting) a tenant that has a banner, show it as an event message popup (notification)
    if (!wasSelected) {
      const banner =
        tenant.infoBanner || (tenant as any).annotations?.['info.projectcapsule.dev/banner'];
      if (banner) {
        enqueueSnackbar(`[${name}] ${banner}`, {
          variant: 'warning',
          autoHideDuration: 8000,
        });
      }
    }

    // Menu auto-closes on ListItem click (standard MUI behavior); re-open the chooser to select/toggle more.
    // The mobile Dialog does not auto-close, so multi-select works smoothly there.
  };

  const handleClear = () => {
    setSelectedTenantNames([]);
    handleClose();
  };

  const handleClose = () => {
    setAnchorEl(null);
    setOpenDialog(false);
  };

  const currentName =
    selectedTenantNames.length === 0
      ? 'No Tenant Filter'
      : selectedTenantNames.length === 1
      ? selectedTenantNames[0]
      : `${selectedTenantNames.length} Tenants`;

  const isScoped = selectedTenantNames.length > 0;
  const selectedTenantIcon =
    isScoped && selectedTenantNames.length === 1
      ? getTenantIcon(selectedTenants[0] as any)
      : undefined;

  const renderTenantItem = (tenant: TenantItem, isSelected: boolean) => {
    const name = tenant.metadata?.name || 'Unnamed';
    const ns = tenant.status?.namespaces;
    const nsCount = typeof ns === 'number' ? ns : ns?.length ?? tenant.status?.size ?? 0;
    const state = tenant.status?.state || 'Active';
    const stateColor = tenantStateChipColor(state);
    const stateBackground =
      stateColor === 'success'
        ? green[700]
        : stateColor === 'warning'
        ? tenantAccent
        : stateColor === 'error'
        ? red[700]
        : blue[700];
    const stateText = theme.palette.getContrastText(stateBackground);
    const icon = getTenantIcon(tenant as any);
    const description =
      tenant.infoDescription ||
      (tenant as any).annotations?.['info.projectcapsule.dev/description'];
    return (
      <ListItem
        key={name}
        onClick={() => handleToggle(tenant)}
        selected={isSelected}
        sx={{
          border: '1px solid',
          borderColor: isSelected ? tenantAccent : 'transparent',
          borderRadius: 1.5,
          cursor: 'pointer',
          my: 0.375,
          transition: theme.transitions.create(['background-color', 'border-color']),
          '&:hover': {
            bgcolor: alpha(tenantAccent, 0.1),
          },
          '&.Mui-selected': {
            bgcolor: alpha(tenantAccent, 0.16),
          },
          '&.Mui-selected:hover': {
            bgcolor: alpha(tenantAccent, 0.22),
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Checkbox
            checked={isSelected}
            disableRipple
            edge="start"
            size="small"
            sx={{
              color: isSelected ? tenantAccent : 'text.secondary',
              '&.Mui-checked': { color: tenantAccent },
            }}
            tabIndex={-1}
          />
        </ListItemIcon>
        <ListItemAvatar>
          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: 'background.paper',
              border: 0,
            }}
          >
            <TenantVisualIcon icon={icon} size={22} />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primaryTypographyProps={{
            color: isSelected ? tenantAccent : 'text.primary',
            fontWeight: isSelected ? 600 : 500,
          }}
          primary={name}
          secondary={
            <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Chip
                  size="small"
                  label={state}
                  color={stateColor}
                  variant="filled"
                  sx={{
                    bgcolor: `${stateBackground} !important`,
                    color: `${stateText} !important`,
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    '& .MuiChip-label': { color: 'inherit' },
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {nsCount} namespace{nsCount === 1 ? '' : 's'}
                </Typography>
              </Box>
              {description && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {description.length > 60 ? `${description.slice(0, 57)}...` : description}
                </Typography>
              )}
            </Box>
          }
        />
      </ListItem>
    );
  };

  const content = (
    <List sx={{ minWidth: 260, px: 0.75, py: 0.75 }} dense>
      <ListItem
        onClick={handleClear}
        selected={!isScoped}
        sx={{
          border: '1px solid',
          borderColor: !isScoped ? tenantAccent : 'transparent',
          borderRadius: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(tenantAccent, 0.1) },
          '&.Mui-selected': { bgcolor: alpha(tenantAccent, 0.16) },
          '&.Mui-selected:hover': { bgcolor: alpha(tenantAccent, 0.22) },
        }}
      >
        <ListItemAvatar>
          <Avatar
            sx={{
              width: 28,
              height: 28,
              fontSize: '0.7rem',
              bgcolor: !isScoped ? tenantAccent : alpha(tenantAccent, 0.12),
              color: !isScoped ? tenantAccentText : tenantAccent,
            }}
          >
            <Icon icon="mdi:filter-off-outline" width={18} height={18} />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary="No Tenant Filter"
          primaryTypographyProps={{
            color: !isScoped ? tenantAccent : 'text.primary',
            fontWeight: !isScoped ? 600 : 500,
          }}
          secondary="Show resources from every namespace"
        />
      </ListItem>
      <Divider sx={{ my: 0.5 }} />
      {tenants.length === 0 && (
        <ListItem>
          <ListItemText primary="No tenants found" />
        </ListItem>
      )}
      {tenants.map(tenant =>
        renderTenantItem(
          tenant as any,
          selectedTenantNames.includes((tenant as any).metadata?.name || '')
        )
      )}
    </List>
  );

  return (
    <>
      <Tooltip
        title={
          isScoped
            ? `Scoped to ${selectedTenantNames.length} tenant(s): ${selectedTenantNames.join(', ')}`
            : 'No Tenant filter: showing every namespace'
        }
      >
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={handleClick}
          startIcon={
            <Avatar
              sx={{
                width: 18,
                height: 18,
                fontSize: '0.65rem',
                bgcolor: alpha(tenantAccentText, 0.12),
                color: tenantAccentText,
              }}
            >
              {isScoped && selectedTenantNames.length === 1 ? (
                <TenantVisualIcon icon={selectedTenantIcon} size={16} />
              ) : isScoped && selectedTenantNames.length > 1 ? (
                String(selectedTenantNames.length)
              ) : (
                '∀'
              )}
            </Avatar>
          }
          sx={{
            textTransform: 'none',
            maxWidth: 200,
            fontWeight: 600,
            bgcolor: `${tenantAccent} !important`,
            color: `${tenantAccentText} !important`,
            borderColor: `${tenantAccent} !important`,
            boxShadow: 'none',
            '&:hover': {
              borderColor: `${tenantAccent} !important`,
              bgcolor: `${alpha(tenantAccent, 0.82)} !important`,
              boxShadow: 'none',
            },
            '& .MuiButton-startIcon': { mr: 0.75 },
          }}
          endIcon={<Icon icon="mdi:chevron-down" width={18} height={18} />}
        >
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {currentName}
          </Box>
          {isScoped && (
            <Chip
              label="scoped"
              size="small"
              sx={{
                ml: 0.75,
                height: 16,
                fontSize: '0.55rem',
                bgcolor: alpha(tenantAccentText, 0.14),
                color: tenantAccentText,
              }}
            />
          )}
        </Button>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            border: '1px solid',
            borderColor: alpha(tenantAccent, 0.55),
            borderRadius: 2,
            boxShadow: theme.shadows[8],
            mt: 0.75,
          },
        }}
      >
        {content}
      </Menu>
      <Dialog
        open={openDialog}
        onClose={handleClose}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            border: '1px solid',
            borderColor: alpha(tenantAccent, 0.55),
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle
          sx={{
            borderBottom: '1px solid',
            borderColor: alpha(tenantAccent, 0.45),
            color: tenantAccent,
            fontWeight: 600,
            pb: 1,
          }}
        >
          Select Tenant Scope
        </DialogTitle>
        {content}
      </Dialog>
    </>
  );
}
