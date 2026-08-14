import type { PluginSettingsDetailsProps } from '@kinvolk/headlamp-plugin/lib';
import { Box, TextField } from '@mui/material';
import {
  DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL,
  isDocumentationBaseUrlValid,
} from '../common/capsuleDocumentation';
import type { CapsulePluginConfig } from '../common/CapsuleDocumentationAction';

export function CapsuleSettings({ data, onDataChange }: PluginSettingsDetailsProps) {
  const config = (data || {}) as CapsulePluginConfig;
  const documentationBaseUrl =
    config.documentationBaseUrl ?? DEFAULT_CAPSULE_DOCUMENTATION_BASE_URL;
  const valid = isDocumentationBaseUrlValid(documentationBaseUrl);

  return (
    <Box sx={{ mt: 2, maxWidth: 760 }}>
      <TextField
        fullWidth
        label="Documentation base URL"
        value={documentationBaseUrl}
        error={!valid}
        helperText={
          valid
            ? 'Base URL used by documentation actions. Clear it to use projectcapsule.dev.'
            : 'Enter an absolute HTTP or HTTPS URL.'
        }
        onChange={event =>
          onDataChange?.({
            ...data,
            documentationBaseUrl: event.target.value,
          })
        }
      />
    </Box>
  );
}
