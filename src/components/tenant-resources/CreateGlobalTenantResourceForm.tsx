import {
  CreateResourceForm,
  type FormSection,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box, Button, IconButton, TextField, Typography } from '@mui/material';
import { AnchoredSubheading } from '../common/SectionAnchor';

export interface CreateGlobalTenantResourceFormProps {
  resource?: Record<string, any>;
  onChange: (resource: Record<string, any>) => void;
}

export default function CreateGlobalTenantResourceForm(props: CreateGlobalTenantResourceFormProps) {
  const { resource, onChange } = props;
  const normalizedResource = resource ?? {};

  const sections: FormSection[] = [
    {
      title: 'Metadata',
      fields: [{ key: 'name', path: 'metadata.name', label: 'Name', required: true }],
    },
    {
      title: 'Resync',
      fields: [
        {
          key: 'resyncPeriod',
          path: 'spec.resyncPeriod',
          label: 'Resync Period',
          helperText: 'How often Capsule re-applies (e.g. 5m).',
        },
      ],
    },
  ];

  // Structured editor for namespacedItems (primary use-case per Capsule docs)
  const currentRules: any[] = normalizedResource.spec?.resources || [];
  const rules =
    currentRules.length > 0
      ? currentRules
      : [{ namespacedItems: [{ apiVersion: 'v1', kind: '', name: '' }] }];

  const updateRules = (newRules: any[]) => {
    const cleaned = newRules.filter(r => r && (r.namespacedItems?.length || r.rawItems?.length));
    const updated = {
      ...normalizedResource,
      spec: {
        ...(normalizedResource.spec || {}),
        resources:
          cleaned.length > 0
            ? cleaned
            : [{ namespacedItems: [{ apiVersion: 'v1', kind: '', name: '' }] }],
      },
    };
    onChange(updated);
  };

  const addRule = () => {
    updateRules([...rules, { namespacedItems: [{ apiVersion: 'v1', kind: '', name: '' }] }]);
  };

  const removeRule = (rIndex: number) => {
    updateRules(rules.filter((_: any, i: number) => i !== rIndex));
  };

  const addItemToRule = (rIndex: number) => {
    const newRules = [...rules];
    if (!newRules[rIndex].namespacedItems) newRules[rIndex].namespacedItems = [];
    newRules[rIndex].namespacedItems.push({
      apiVersion: 'v1',
      kind: '',
      name: '',
    });
    updateRules(newRules);
  };

  const updateItem = (rIndex: number, iIndex: number, field: string, value: string) => {
    const newRules = [...rules];
    newRules[rIndex].namespacedItems[iIndex][field] = value;
    updateRules(newRules);
  };

  const removeItem = (rIndex: number, iIndex: number) => {
    const newRules = [...rules];
    newRules[rIndex].namespacedItems.splice(iIndex, 1);
    if (newRules[rIndex].namespacedItems.length === 0) delete newRules[rIndex].namespacedItems;
    updateRules(newRules);
  };

  return (
    <Box>
      <CreateResourceForm sections={sections} resource={normalizedResource} onChange={onChange} />

      <Box sx={{ mt: 1.5 }}>
        <AnchoredSubheading title="Replicated Resources" variant="subtitle1" gutterBottom />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          GlobalTenantResource (cluster admin) replicates into namespaces of selected Tenants. Use{' '}
          <strong>namespacedItems</strong> to copy existing objects (ConfigMaps, Secrets, etc.).
          Full features (generators with Go templates, selectors) via YAML after creation. See{' '}
          <a
            href="https://projectcapsule.dev/docs/replications/global/"
            target="_blank"
            rel="noreferrer"
          >
            docs
          </a>
          .
        </Typography>

        {rules.map((rule: any, rIndex: number) => (
          <Box
            key={rIndex}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              p: 2,
              mb: 2,
              borderRadius: 1,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" fontWeight={500}>
                Rule #{rIndex + 1}
              </Typography>
              <IconButton size="small" onClick={() => removeRule(rIndex)}>
                ×
              </IconButton>
            </Box>

            {(rule.namespacedItems || []).map((item: any, iIndex: number) => (
              <Box
                key={iIndex}
                sx={{
                  display: 'flex',
                  gap: 1,
                  mb: 1,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <TextField
                  size="small"
                  label="apiVersion"
                  value={item.apiVersion || 'v1'}
                  onChange={e => updateItem(rIndex, iIndex, 'apiVersion', e.target.value)}
                  sx={{ width: 90 }}
                />
                <TextField
                  size="small"
                  label="kind"
                  value={item.kind || ''}
                  onChange={e => updateItem(rIndex, iIndex, 'kind', e.target.value)}
                  sx={{ width: 130 }}
                  placeholder="ConfigMap"
                />
                <TextField
                  size="small"
                  label="name"
                  value={item.name || ''}
                  onChange={e => updateItem(rIndex, iIndex, 'name', e.target.value)}
                  sx={{ flex: 1 }}
                  placeholder="my-config"
                />
                <TextField
                  size="small"
                  label="source namespace"
                  value={item.namespace || ''}
                  onChange={e => updateItem(rIndex, iIndex, 'namespace', e.target.value)}
                  sx={{ width: 160 }}
                />
                <IconButton size="small" onClick={() => removeItem(rIndex, iIndex)}>
                  ×
                </IconButton>
              </Box>
            ))}

            <Button size="small" onClick={() => addItemToRule(rIndex)}>
              + Add namespaced item
            </Button>
          </Box>
        ))}

        <Button size="small" onClick={addRule}>
          + Add rule
        </Button>
      </Box>
    </Box>
  );
}
