import {
  CreateResourceForm,
  type FormSection,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import {
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
import { AnchoredSubheading } from '../common/SectionAnchor';

export interface CreateGlobalCustomQuotaFormProps {
  resource?: Record<string, any>;
  onChange: (resource: Record<string, any>) => void;
}

export default function CreateGlobalCustomQuotaForm(props: CreateGlobalCustomQuotaFormProps) {
  const { resource, onChange } = props;
  const normalizedResource = resource ?? {};

  const sections: FormSection[] = [
    {
      title: 'Metadata',
      fields: [{ key: 'name', path: 'metadata.name', label: 'Name', required: true }],
    },
    {
      title: 'Limit',
      fields: [
        {
          key: 'limit',
          path: 'spec.limit',
          label: 'Limit',
          required: true,
          helperText: 'Total allowed across selected namespaces. e.g. "500Gi" or "10"',
        },
      ],
    },
  ];

  const currentSources: any[] = normalizedResource.spec?.sources || [];
  const sources =
    currentSources.length > 0 ? currentSources : [{ apiVersion: 'v1', kind: 'Pod', op: 'count' }];

  const updateSources = (newSources: any[]) => {
    const cleaned = newSources.filter(s => s.kind);
    const updated = {
      ...normalizedResource,
      spec: {
        ...(normalizedResource.spec || {}),
        sources: cleaned.length > 0 ? cleaned : [{ apiVersion: 'v1', kind: 'Pod', op: 'count' }],
      },
    };
    onChange(updated);
  };

  const addSource = () => {
    updateSources([...sources, { apiVersion: 'v1', kind: 'Pod', op: 'count' }]);
  };

  const removeSource = (index: number) => {
    const newSources = sources.filter((_: any, i: number) => i !== index);
    updateSources(newSources);
  };

  const changeSource = (index: number, field: string, value: string) => {
    const newSources = [...sources];
    newSources[index] = { ...newSources[index], [field]: value };
    if (field === 'op' && value === 'count') {
      delete newSources[index].path;
    }
    updateSources(newSources);
  };

  const nsSelectors: any[] = normalizedResource.spec?.namespaceSelectors || [];
  const updateNsSelectors = (newSels: any[]) => {
    const updated = {
      ...normalizedResource,
      spec: {
        ...(normalizedResource.spec || {}),
        namespaceSelectors: newSels.length > 0 ? newSels : undefined,
      },
    };
    onChange(updated);
  };

  return (
    <Box>
      <CreateResourceForm sections={sections} resource={normalizedResource} onChange={onChange} />

      <Box sx={{ mt: 1.5 }}>
        <AnchoredSubheading title="Scope (which namespaces)" variant="subtitle1" gutterBottom />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          GlobalCustomQuota applies across many namespaces (typically via tenant label). Add
          namespaceSelectors.
        </Typography>

        <TextField
          fullWidth
          size="small"
          label="Match tenant label (quick)"
          value={nsSelectors[0]?.matchLabels?.['capsule.clastix.io/tenant'] || ''}
          onChange={e => {
            const val = e.target.value.trim();
            const sel = val ? { matchLabels: { 'capsule.clastix.io/tenant': val } } : {};
            updateNsSelectors(val ? [sel] : []);
          }}
          placeholder="oil  (will match namespaces with label capsule.clastix.io/tenant=oil)"
          sx={{ mb: 1.5 }}
          helperText="Most common: target one tenant's namespaces"
        />

        <AnchoredSubheading
          title="Sources (what to count)"
          variant="subtitle1"
          gutterBottom
          sx={{ mt: 2 }}
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Define GVK + operation. Use count for number of objects, add/sub + path for quantities
          (storage, cpu...). Full selectors documented at projectcapsule.dev.
        </Typography>

        {sources.map((source: any, index: number) => (
          <Box
            key={index}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              p: 1.5,
              mb: 1.5,
              borderRadius: 1,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="APIVersion"
                value={source.apiVersion || 'v1'}
                onChange={e => changeSource(index, 'apiVersion', e.target.value)}
                sx={{ width: 110 }}
              />
              <TextField
                size="small"
                label="Kind"
                value={source.kind || ''}
                onChange={e => changeSource(index, 'kind', e.target.value)}
                sx={{ flex: 1, minWidth: 140 }}
                placeholder="Pod, PersistentVolumeClaim, Service..."
              />
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Op</InputLabel>
                <Select
                  value={source.op || 'count'}
                  label="Op"
                  onChange={e => changeSource(index, 'op', e.target.value as string)}
                >
                  <MenuItem value="count">count</MenuItem>
                  <MenuItem value="add">add</MenuItem>
                  <MenuItem value="sub">sub</MenuItem>
                </Select>
              </FormControl>
              {source.op !== 'count' && (
                <TextField
                  size="small"
                  label="Path"
                  value={source.path || ''}
                  onChange={e => changeSource(index, 'path', e.target.value)}
                  sx={{ flex: 2, minWidth: 200 }}
                  placeholder=".spec.resources.requests.storage"
                />
              )}
              <IconButton
                size="small"
                onClick={() => removeSource(index)}
                disabled={sources.length <= 1}
                aria-label="remove source"
                sx={{ alignSelf: 'center' }}
              >
                ×
              </IconButton>
            </Box>
          </Box>
        ))}

        <Button size="small" onClick={addSource} sx={{ mt: 0.5 }}>
          + Add Source
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        ScopeSelectors, emitMetricPerClaimUsage and advanced selectors available after creation /
        via full YAML.
      </Typography>
    </Box>
  );
}
