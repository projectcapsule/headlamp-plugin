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

export interface CreateCustomQuotaFormProps {
  resource?: Record<string, any>;
  onChange: (resource: Record<string, any>) => void;
}

export default function CreateCustomQuotaForm(props: CreateCustomQuotaFormProps) {
  const { resource, onChange } = props;
  const normalizedResource = resource ?? {};

  const sections: FormSection[] = [
    {
      title: 'Metadata',
      fields: [
        { key: 'name', path: 'metadata.name', label: 'Name', required: true },
        {
          key: 'namespace',
          path: 'metadata.namespace',
          label: 'Namespace (where this quota applies)',
          type: 'namespace' as const,
        },
      ],
    },
    {
      title: 'Limit',
      fields: [
        {
          key: 'limit',
          path: 'spec.limit',
          label: 'Limit',
          required: true,
          helperText: 'Total allowed usage. Examples: "100Gi" (storage), "5" (count), "10" (pods)',
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
    // clear path when switching to count
    if (field === 'op' && value === 'count') {
      delete newSources[index].path;
    }
    updateSources(newSources);
  };

  return (
    <Box>
      <CreateResourceForm sections={sections} resource={normalizedResource} onChange={onChange} />

      <Box sx={{ mt: 1.5 }}>
        <AnchoredSubheading title="Sources (what to count)" variant="subtitle1" gutterBottom />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Define which objects contribute to this quota (e.g. count Pods, sum PVC storage requests).
          See Capsule Custom Quotas docs for JSONPath paths, selectors, and Global vs namespaced
          behavior.
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
                placeholder="v1"
              />
              <TextField
                size="small"
                label="Kind"
                value={source.kind || ''}
                onChange={e => changeSource(index, 'kind', e.target.value)}
                sx={{ flex: 1, minWidth: 140 }}
                placeholder="Pod or PersistentVolumeClaim"
              />
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Operation</InputLabel>
                <Select
                  value={source.op || 'count'}
                  label="Operation"
                  onChange={e => changeSource(index, 'op', e.target.value as string)}
                >
                  <MenuItem value="count">count (number of objects)</MenuItem>
                  <MenuItem value="add">add (sum values via path)</MenuItem>
                  <MenuItem value="sub">sub (subtract values)</MenuItem>
                </Select>
              </FormControl>
              {source.op !== 'count' && (
                <TextField
                  size="small"
                  label="Path (JSONPath)"
                  value={source.path || ''}
                  onChange={e => changeSource(index, 'path', e.target.value)}
                  sx={{ flex: 2, minWidth: 200 }}
                  placeholder=".spec.resources.requests.storage  or  .spec.containers[*].resources.requests.cpu"
                  helperText="Required for add/sub"
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
            <Typography variant="caption" color="text.secondary">
              Example: count Pods, or add .spec.resources.requests.storage for PVCs.
            </Typography>
          </Box>
        ))}

        <Button size="small" onClick={addSource} sx={{ mt: 0.5 }}>
          + Add Source
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Advanced selectors (label/field/scope) and options can be added after creation or via YAML.
      </Typography>
    </Box>
  );
}
