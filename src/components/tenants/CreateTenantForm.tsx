import {
  CreateResourceForm,
  type FormSection,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { AnchoredSubheading } from '../common/SectionAnchor';

export interface CreateTenantFormProps {
  resource?: Record<string, any>;
  onChange: (resource: Record<string, any>) => void;
}

export default function CreateTenantForm(props: CreateTenantFormProps) {
  const { resource = {}, onChange } = props;

  // Use base form only for simple metadata
  const metadataSections: FormSection[] = [
    {
      title: 'Metadata',
      fields: [{ key: 'name', path: 'metadata.name', label: 'Name', required: true }],
    },
  ];

  // Custom nice UI for owners (what users actually input: list of users/groups)
  const currentOwners: any[] = resource.spec?.owners || [];
  const owners = currentOwners.length > 0 ? currentOwners : [{ kind: 'User', name: '' }];

  const updateOwners = (newOwners: any[]) => {
    const cleaned = newOwners.filter(o => o.name?.trim());
    const updated = {
      ...resource,
      spec: {
        ...(resource.spec || {}),
        owners: cleaned.length > 0 ? cleaned : [{ kind: 'User', name: '' }],
      },
    };
    onChange(updated);
  };

  const addOwner = () => {
    updateOwners([...owners, { kind: 'User', name: '' }]);
  };

  const removeOwner = (index: number) => {
    const newOwners = owners.filter((_: any, i: number) => i !== index);
    updateOwners(newOwners);
  };

  const changeOwner = (index: number, field: 'kind' | 'name', value: string) => {
    const newOwners = [...owners];
    newOwners[index] = { ...newOwners[index], [field]: value };
    updateOwners(newOwners);
  };

  // Friendly annotations for plugin UX (icon, description, links, banner) — from Capsule docs
  const annotations = resource.metadata?.annotations || {};
  const updateAnnotation = (key: string, value: string) => {
    const newAnnotations = { ...annotations };
    if (value?.trim()) {
      newAnnotations[key] = value.trim();
    } else {
      delete newAnnotations[key];
    }
    const updated = {
      ...resource,
      metadata: {
        ...(resource.metadata || {}),
        annotations: Object.keys(newAnnotations).length > 0 ? newAnnotations : undefined,
      },
    };
    onChange(updated);
  };

  const linksStr = annotations['info.projectcapsule.dev/links'] || '';
  const [linksInput, setLinksInput] = React.useState(linksStr);
  const updateLinks = (val: string) => {
    setLinksInput(val);
    try {
      if (val.trim()) {
        JSON.parse(val); // validate
        updateAnnotation('info.projectcapsule.dev/links', val);
      } else {
        updateAnnotation('info.projectcapsule.dev/links', '');
      }
    } catch {
      // allow typing invalid temporarily
    }
  };

  return (
    <Box>
      <CreateResourceForm sections={metadataSections} resource={resource} onChange={onChange} />

      <Box sx={{ mt: 1.5 }}>
        <AnchoredSubheading title="Owners" variant="subtitle1" gutterBottom />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Users or Groups who will own this Tenant and can create/manage its Namespaces (see Capsule
          docs on Permissions).
        </Typography>

        {owners.map((owner: any, index: number) => (
          <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Kind</InputLabel>
              <Select
                value={owner.kind || 'User'}
                label="Kind"
                onChange={e => changeOwner(index, 'kind', e.target.value as string)}
              >
                <MenuItem value="User">User</MenuItem>
                <MenuItem value="Group">Group</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Name"
              value={owner.name || ''}
              onChange={e => changeOwner(index, 'name', e.target.value)}
              sx={{ flex: 1 }}
              placeholder="e.g. alice@example.com or my-team-admins"
            />
            <IconButton
              size="small"
              onClick={() => removeOwner(index)}
              disabled={owners.length <= 1}
              aria-label="remove owner"
            >
              ×
            </IconButton>
          </Box>
        ))}

        <Button size="small" startIcon={<span>+</span>} onClick={addOwner} sx={{ mt: 0.5 }}>
          Add Owner
        </Button>
      </Box>

      {/* User-friendly annotations (heavily used by this plugin per Capsule docs) */}
      <Box sx={{ mt: 2.5 }}>
        <AnchoredSubheading
          title="Tenant Info & Appearance (optional)"
          variant="subtitle1"
          gutterBottom
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          These are stored as annotations and improve the experience in the Capsule plugin (chooser,
          lists, detail, overview). See{' '}
          <a
            href="https://projectcapsule.dev/docs/tenants/metadata/"
            target="_blank"
            rel="noreferrer"
          >
            Capsule Metadata docs
          </a>
          .
        </Typography>

        <TextField
          fullWidth
          size="small"
          label="Icon URL"
          value={annotations['info.projectcapsule.dev/icon'] || ''}
          onChange={e => updateAnnotation('info.projectcapsule.dev/icon', e.target.value)}
          placeholder="https://example.com/my-tenant-icon.png"
          sx={{ mb: 1.5 }}
          helperText="Avatar shown in tenant switcher and lists"
        />

        <TextField
          fullWidth
          size="small"
          label="Description"
          value={annotations['info.projectcapsule.dev/description'] || ''}
          onChange={e => updateAnnotation('info.projectcapsule.dev/description', e.target.value)}
          placeholder="Production tenant for the payments team"
          sx={{ mb: 1.5 }}
          multiline
          minRows={2}
        />

        <TextField
          fullWidth
          size="small"
          label="Links (JSON)"
          value={linksInput}
          onChange={e => updateLinks(e.target.value)}
          placeholder='[{"title":"Grafana","url":"https://...","icon":"fa-solid fa-chart-line"}]'
          sx={{ mb: 1 }}
          helperText="Per link: icon accepts Font Awesome classes, Iconify names, or image URLs."
        />

        <TextField
          fullWidth
          size="small"
          label="Banner Image URL"
          value={annotations['info.projectcapsule.dev/banner'] || ''}
          onChange={e => updateAnnotation('info.projectcapsule.dev/banner', e.target.value)}
          placeholder="https://example.com/tenant-banner.jpg"
          helperText="Large banner shown at top of tenant detail view"
        />
      </Box>

      {/* Advanced / other spec fields still available via full editor or edit later */}
      <Accordion sx={{ mt: 2 }} defaultExpanded={false}>
        <AccordionSummary>
          <Typography>
            Advanced Tenant Settings (additionalPodSpecs, quotas, rules, etc.)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary">
            For advanced configuration (pod defaults, forbidden labels/annotations, resource pools,
            network policies, etc.) use the full YAML editor or edit the Tenant after creation. See{' '}
            <a href="https://projectcapsule.dev/docs/tenants/" target="_blank" rel="noreferrer">
              Capsule Tenants docs
            </a>{' '}
            and the Tenant detail page.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
