import {
  MetadataDisplay,
  type NameValueTableRow,
} from '@kinvolk/headlamp-plugin/lib/components/common';
import { Typography } from '@mui/material';
import React, { Children, cloneElement, isValidElement } from 'react';
import { CAPSULE_CRDS } from '../../resources/capsuleCustomResources';
import { Tenants } from '../../resources/tenants';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { NamespaceCustomQuotas, NamespaceTenantResources } from './NamespaceCapsuleResources';
import {
  CAPSULE_NAMESPACE_CUSTOM_QUOTAS_SECTION_ID,
  CAPSULE_NAMESPACE_QUOTA_SECTION_ID,
  CAPSULE_NAMESPACE_TENANT_RESOURCES_SECTION_ID,
  HEADLAMP_NAMESPACE_DETAILS_VIEW_SECTION_ID,
  HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID,
  insertDetailsSectionBefore,
  tenantNameForNamespace,
} from './namespaceDetailsSections';
import { NamespaceQuotaSystems } from './NamespaceQuotaSystems';

function objectKind(resource: any): string {
  return resource?.kind || resource?.jsonData?.kind || resource?.constructor?.kind || '';
}

function NamespaceTenantMetadata({ namespace }: { namespace: any }) {
  const [tenants] = Tenants.useList({ cluster: namespace?.cluster });
  const tenantName = tenantNameForNamespace(namespace, tenants || []);
  if (!tenantName) {
    return <Typography color="text.secondary">Not managed by a Capsule Tenant</Typography>;
  }

  return (
    <CapsuleResourceLink crd={CAPSULE_CRDS.Tenant} name={tenantName}>
      {tenantName}
    </CapsuleResourceLink>
  );
}

function rowsWithTenant(
  existing:
    | NameValueTableRow[]
    | ((resource: any) => NameValueTableRow[] | null)
    | null
    | undefined,
  resource: any
): NameValueTableRow[] {
  const rows = typeof existing === 'function' ? existing(resource) || [] : existing || [];
  if (rows.some(row => row.name === 'Tenant')) return rows;
  return [
    ...rows,
    {
      name: 'Tenant',
      value: <NamespaceTenantMetadata namespace={resource} />,
    },
  ];
}

function addTenantToMetadata(resource: any, sections: any[]): any[] {
  return sections.map(section => {
    if (section?.id !== 'METADATA' || !isValidElement(section.section)) return section;
    const metadataSection = section.section as React.ReactElement<any>;
    let changed = false;
    const children = Children.map(metadataSection.props.children, child => {
      if (!isValidElement(child)) return child;
      const childElement = child as React.ReactElement<any>;
      const isMetadata =
        childElement.type === MetadataDisplay ||
        (childElement.props.resource === resource && 'extraRows' in childElement.props);
      if (!isMetadata) return child;
      changed = true;
      const existingRows = childElement.props.extraRows;
      return cloneElement(childElement, {
        extraRows: (item: any) => rowsWithTenant(existingRows, item),
      });
    });
    return changed
      ? { ...section, section: cloneElement(metadataSection, undefined, children) }
      : section;
  });
}

/** Public DetailsGrid processor used to augment only native Namespace details. */
export function processNamespaceDetailsSections(resource: any, sections: any[]) {
  if (objectKind(resource) !== 'Namespace') return sections;
  const withTenant = addTenantToMetadata(resource, sections);
  const withQuotaSystems = insertDetailsSectionBefore(
    withTenant,
    {
      id: CAPSULE_NAMESPACE_QUOTA_SECTION_ID,
      section: <NamespaceQuotaSystems namespace={resource} />,
    },
    HEADLAMP_NAMESPACE_RESOURCE_QUOTAS_SECTION_ID
  );
  const withCustomQuotas = insertDetailsSectionBefore(
    withQuotaSystems,
    {
      id: CAPSULE_NAMESPACE_CUSTOM_QUOTAS_SECTION_ID,
      section: <NamespaceCustomQuotas namespace={resource} />,
    },
    HEADLAMP_NAMESPACE_DETAILS_VIEW_SECTION_ID
  );
  return insertDetailsSectionBefore(
    withCustomQuotas,
    {
      id: CAPSULE_NAMESPACE_TENANT_RESOURCES_SECTION_ID,
      section: <NamespaceTenantResources namespace={resource} />,
    },
    HEADLAMP_NAMESPACE_DETAILS_VIEW_SECTION_ID
  );
}
