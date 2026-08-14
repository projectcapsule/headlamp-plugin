import { Icon } from '@iconify/react';
import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import type {
  ColumnType,
  ResourceTableColumn,
} from '@kinvolk/headlamp-plugin/lib/components/common';
import { Avatar, Box, Chip, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { Tenants } from '../../resources/tenants';
import {
  getTenantDescription,
  getTenantIcon,
  getTenantLinks,
  isImageRef,
  safeUrl,
} from '../../utils/tenantMeta';
import { findSpaceInfo, getTenantSpaceNames, isSpaceReady } from '../../utils/tenantSpaces';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { TenantCordonAction } from '../common/ReconcileActions';
import { StatCard } from '../common/StatCard';
import { SummaryCardGrid } from '../common/SummaryCardGrid';

export const tenantColumns: (ResourceTableColumn<Tenants> | ColumnType)[] = [
  {
    id: 'name',
    label: 'Name',
    getValue: (item: Tenants) => item.getName(),
    render: (item: Tenants) => {
      const icon = getTenantIcon(item);
      const desc = getTenantDescription(item);
      return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title={desc || ''}>
            <CapsuleResourceLink crd={CAPSULE_CRDS.Tenant} name={item.getName()}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                {item.getName()}
                {icon && <Avatar src={safeUrl(icon)} sx={{ width: 24, height: 24 }} />}
              </Box>
            </CapsuleResourceLink>
          </Tooltip>
        </Box>
      );
    },
  },
  {
    id: 'description',
    label: 'Description',
    getValue: (item: Tenants) => getTenantDescription(item) || '',
    render: (item: Tenants) => {
      const desc = getTenantDescription(item);
      if (!desc) return '—';
      return (
        <Typography
          variant="body2"
          sx={{
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {desc}
        </Typography>
      );
    },
  },
  {
    id: 'links',
    label: 'Links',
    getValue: (item: Tenants) => getTenantLinks(item).length,
    render: (item: Tenants) => {
      const links = getTenantLinks(item);
      if (links.length === 0) return '—';
      return (
        <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
          {links.slice(0, 2).map((link, i: number) => (
            <Chip
              key={i}
              size="small"
              label={link.title || 'Link'}
              component="a"
              href={safeUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              icon={
                link.icon ? (
                  isImageRef(link.icon) ? (
                    <img
                      src={safeUrl(link.icon)}
                      style={{ width: 14, height: 14, objectFit: 'contain' }}
                      alt=""
                    />
                  ) : Icon && typeof Icon === 'function' ? (
                    <Icon icon={link.icon} style={{ fontSize: 14 }} />
                  ) : undefined
                ) : undefined
              }
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
          ))}
          {links.length > 2 && (
            <Chip
              size="small"
              label={`+${links.length - 2}`}
              sx={{ height: 18, fontSize: '0.6rem' }}
            />
          )}
        </Box>
      );
    },
  },
  {
    id: 'state',
    label: 'State',
    getValue: (item: Tenants) => item.status?.state || 'Unknown',
    render: (item: Tenants) => {
      const state = item.status?.state || 'Active';
      return (
        <Chip
          size="small"
          label={state}
          color={state === 'Active' ? 'success' : state === 'Cordoned' ? 'warning' : 'default'}
        />
      );
    },
  },
  {
    id: 'namespaces',
    label: 'Namespaces',
    getValue: (item: Tenants) =>
      (Array.isArray(item.status?.namespaces) ? item.status?.namespaces.length : undefined) ??
      item.status?.size ??
      0,
    render: (item: Tenants) => {
      const count =
        (Array.isArray(item.status?.namespaces) ? item.status?.namespaces.length : undefined) ??
        item.status?.size ??
        0;
      return (
        <Chip
          size="small"
          label={`${count} namespace${count === 1 ? '' : 's'}`}
          variant="outlined"
        />
      );
    },
  },
  'age',
];

export function TenantsList() {
  const [tenants, error] = Tenants.useList();
  const [allNS] = K8s.ResourceClasses.Namespace.useList();

  if (error) {
    return (
      <Typography color="error">
        Error loading Tenants: {error.message || String(error)}. Is Capsule installed in the cluster
        Headlamp is connected to, and do you have permission to list tenants.capsule.clastix.io?
      </Typography>
    );
  }

  const stateStats = useMemo(() => {
    let active = 0;
    let cordoned = 0;
    (tenants || []).forEach((t: any) => {
      const state = t.status?.state || t.jsonData?.status?.state || 'Active';
      const isCordoned = state === 'Cordoned' || !!t.jsonData?.spec?.cordoned;
      if (isCordoned) cordoned++;
      else active++;
    });
    return { active, cordoned, total: tenants?.length || 0 };
  }, [tenants]);

  const nsStats = useMemo(() => {
    if (!tenants || !allNS) {
      return { ready: 0, notReady: 0, total: 0 };
    }
    let ready = 0;
    let notReady = 0;
    tenants.forEach(t => {
      const tenantNsNames = getTenantSpaceNames(t);
      const nameSet = new Set(tenantNsNames);
      const tns = allNS.filter((ns: { getName: () => string }) => nameSet.has(ns.getName()));
      tns.forEach(
        (ns: { getName: () => string; jsonData?: { status?: { conditions?: unknown[] } } }) => {
          const spaceInfo = findSpaceInfo(t, ns.getName());
          let isR: boolean;
          if (spaceInfo?.conditions?.length) {
            isR = isSpaceReady(spaceInfo);
          } else {
            const conditions = ns.jsonData?.status?.conditions || [];
            const cond = (conditions as { type?: string; status?: string | boolean }[]).find(c =>
              c.type?.toLowerCase().includes('ready')
            );
            isR = !!(cond && (cond.status === 'True' || cond.status === true));
          }
          if (isR) ready++;
          else notReady++;
        }
      );
    });
    return { ready, notReady, total: ready + notReady };
  }, [tenants, allNS]);

  return (
    <>
      <SummaryCardGrid columns={2} marginBottom={2} inset>
        <StatCard
          label="TENANTS"
          total={stateStats.total}
          segments={[
            { name: 'Active', value: stateStats.active, color: '#4caf50' },
            { name: 'Cordoned', value: stateStats.cordoned, color: '#ff9800' },
          ]}
          chips={[
            { label: `${stateStats.active} Active`, color: 'success' },
            { label: `${stateStats.cordoned} Cordoned`, color: 'warning' },
          ]}
        />
        <StatCard
          label="MANAGED NAMESPACES"
          total={nsStats.total}
          segments={[
            { name: 'Ready', value: nsStats.ready, color: '#4caf50' },
            { name: 'Not Ready', value: nsStats.notReady, color: '#f44336' },
          ]}
          chips={[
            { label: `${nsStats.ready} Ready`, color: 'success' },
            { label: `${nsStats.notReady} Not Ready`, color: 'error' },
          ]}
        />
      </SummaryCardGrid>

      <ResourceListView
        title="Tenants"
        resourceClass={Tenants}
        columns={tenantColumns}
        enableRowActions
        actions={[
          {
            id: 'cordon-tenant',
            action: ({ item, closeMenu }: any) => (
              <TenantCordonAction item={item} closeMenu={closeMenu} buttonStyle="menu" />
            ),
          },
        ]}
      />
    </>
  );
}
