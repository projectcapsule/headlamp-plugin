import { Icon } from '@iconify/react';
import { Activity, ApiProxy, K8s, Router } from '@kinvolk/headlamp-plugin/lib';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import Form from '@rjsf/mui';
import { useSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  CAPSULE_CRDS,
  capsuleCustomResourceRouteParams,
} from '../../resources/capsuleCustomResources';
import {
  GlobalResourcePermitTemplate,
  ResourcePermitTemplate,
} from '../../resources/resourcePermits';
import { AnchoredSectionBox as SectionBox } from '../common/AnchoredSectionBox';
import { CapsuleResourceLink } from '../common/CapsuleResourceLink';
import { capsuleResourceTags } from '../tags/capsuleTags';
import { KubernetesResourceSchemaWidget } from './KubernetesResourceSchemaFieldInput';
import {
  buildCreateResourcePermit,
  filterResourcePermitTemplates,
  groupResourcePermitTemplates,
} from './resourcePermitCreate';
import { templateApprovalMode } from './resourcePermitHelpers';
import {
  buildResourcePermitUiSchema,
  resourcePermitDefaultParamData,
  resourcePermitParamSchema2020,
  resourcePermitSchemaValidator,
} from './resourcePermitJsonSchema';
import { KUBERNETES_RESOURCE_WIDGET } from './resourcePermitKubernetesResource';
import { ResourcePermitTemplateIdentity } from './ResourcePermitTemplatePresentation';
import { ResourcePermitYamlDialog } from './ResourcePermitYamlDialog';

function currentCluster(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.location.pathname.match(/^\/c\/([^/]+)/)?.[1];
}

type ResourcePermitTemplateKind = 'ResourcePermitTemplate' | 'GlobalResourcePermitTemplate';

interface SelectableResourcePermitTemplate {
  key: string;
  kind: ResourcePermitTemplateKind;
  namespace?: string;
  template: any;
}

function templateCatalogKey(
  kind: ResourcePermitTemplateKind,
  namespace: string | undefined,
  name: string
): string {
  return `${kind}/${namespace || '-'}/${name}`;
}

export function openCreateResourcePermitActivity(namespaces: string[] = []) {
  const cluster = currentCluster();
  Activity.launch({
    id: `capsule-create-resource-permit ${[...namespaces].sort().join(',')} ${cluster || ''}`,
    title: 'New ResourcePermit',
    hideTitleInHeader: true,
    location: 'split-right',
    temporary: true,
    cluster,
    content: <CreateResourcePermit cluster={cluster} namespaces={namespaces} />,
    icon: <Icon icon="mdi:shield-plus-outline" width="100%" height="100%" />,
  });
}

export function NewResourcePermitButton({ namespaces }: { namespaces: string[] }) {
  return (
    <Button
      onClick={() => openCreateResourcePermitActivity(namespaces)}
      size="large"
      startIcon={<Icon icon="mdi:shield-plus-outline" />}
      variant="contained"
    >
      New ResourcePermit
    </Button>
  );
}

export function ResourcePermitSetupForm({
  cluster,
  namespaces,
  templateKind,
  templateName,
  templateNamespace,
}: {
  cluster?: string;
  namespaces: string[];
  templateKind: ResourcePermitTemplateKind;
  templateName: string;
  templateNamespace?: string;
}) {
  const resourceType: any =
    templateKind === 'ResourcePermitTemplate'
      ? ResourcePermitTemplate
      : GlobalResourcePermitTemplate;
  const [template, templateError] = resourceType.useGet(
    templateName,
    templateKind === 'ResourcePermitTemplate' ? templateNamespace : undefined,
    { cluster }
  );
  const [visibleNamespaces, namespaceError] = K8s.ResourceClasses.Namespace.useList({ cluster });
  const [name, setName] = useState('');
  const [generateName, setGenerateName] = useState(true);
  const [namespace, setNamespace] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('');
  const [startTime, setStartTime] = useState('');
  const [values, setValues] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ name: string; namespace: string } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [yamlResource, setYamlResource] = useState<any>(null);
  const { enqueueSnackbar } = useSnackbar();
  const history = useHistory();
  const paramSchema = useMemo(
    () =>
      resourcePermitParamSchema2020(
        template?.spec?.paramSchema || { properties: {}, type: 'object' }
      ),
    [template?.spec?.paramSchema]
  );
  const uiSchema = useMemo(() => buildResourcePermitUiSchema(paramSchema), [paramSchema]);
  const initialValues = useMemo(() => resourcePermitDefaultParamData(paramSchema), [paramSchema]);
  const namespaceOptions = useMemo(
    () =>
      [...new Set((visibleNamespaces || []).map(item => item.getName()).filter(Boolean))].sort(),
    [visibleNamespaces]
  );

  useEffect(() => {
    setValues(initialValues);
    setName('');
    setGenerateName(true);
    setReason('');
    setDuration('');
    setStartTime('');
    setErrors({});
    setFormError('');
    setCreated(null);
    setYamlResource(null);
    setActiveStep(0);
  }, [initialValues]);

  useEffect(() => {
    setNamespace(current =>
      namespaceOptions.includes(current)
        ? current
        : namespaceOptions.length === 1
        ? namespaceOptions[0]
        : ''
    );
  }, [namespaceOptions]);

  if (templateError) {
    return (
      <Alert severity="error">
        The selected template cannot be loaded directly or this account does not have get access.
      </Alert>
    );
  }
  if (!template) return <CircularProgress size={20} />;

  const formalErrors = () => {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Required';
    else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name.trim())) {
      nextErrors.name = generateName
        ? 'Use a DNS-compatible lowercase prefix'
        : 'Use a DNS-compatible lowercase name';
    } else if (name.trim().length > (generateName ? 240 : 253)) {
      nextErrors.name = generateName
        ? 'Keep the prefix at or below 240 characters'
        : 'Maximum length is 253 characters';
    }
    if (!namespaceOptions.includes(namespace) || namespaceError) {
      nextErrors.namespace = 'Choose a visible Namespace';
    }
    if (startTime && Number.isNaN(new Date(startTime).getTime())) {
      nextErrors.startTime = 'Enter a valid start time';
    }
    return nextErrors;
  };

  const continueToParameters = () => {
    const nextErrors = formalErrors();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setFormError('');
    setActiveStep(1);
  };

  const currentRequest = (params: any) => {
    const normalizedStartTime = startTime ? new Date(startTime).toISOString() : undefined;
    return buildCreateResourcePermit({
      duration,
      generateName: generateName ? name : undefined,
      name: generateName ? undefined : name,
      namespace,
      params,
      reason,
      startTime: normalizedStartTime,
      templateKind,
      templateName,
    });
  };

  const previewYaml = (params: any) => {
    const nextErrors = formalErrors();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setActiveStep(0);
      return;
    }

    const request = currentRequest(params);
    if (!request) return;
    setFormError('');
    setYamlResource(request.body);
  };

  const submit = async (params: any) => {
    const nextErrors = formalErrors();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setActiveStep(0);
      return;
    }

    const request = currentRequest(params);
    if (!request) return;

    setSubmitting(true);
    setFormError('');
    try {
      const response: any = await ApiProxy.post(request.url, request.body, undefined, { cluster });
      const createdName =
        response?.metadata?.name ||
        response?.data?.metadata?.name ||
        (!request.generated ? request.name : '');
      setCreated({ name: createdName, namespace: request.namespace });
      enqueueSnackbar(`Created ResourcePermit ${request.namespace}/${createdName}`, {
        variant: 'success',
      });
      if (createdName) {
        history.push(
          Router.createRouteURL('customresource', {
            ...capsuleCustomResourceRouteParams(
              CAPSULE_CRDS.ResourcePermit,
              createdName,
              request.namespace
            ),
            cluster,
          })
        );
        Activity.close(
          `capsule-create-resource-permit ${[...namespaces].sort().join(',')} ${cluster || ''}`
        );
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.data?.message ||
        error?.body?.message ||
        error?.message ||
        String(error);
      setFormError(message);
      enqueueSnackbar(`Failed to create ResourcePermit: ${message}`, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <Alert severity="success">
        Created{' '}
        {created.name ? (
          <CapsuleResourceLink
            crd={CAPSULE_CRDS.ResourcePermit}
            name={created.name}
            namespace={created.namespace}
          >
            {created.namespace}/{created.name}
          </CapsuleResourceLink>
        ) : (
          'the ResourcePermit. Its generated name was not returned; refresh the Requests list to open it'
        )}
        .
      </Alert>
    );
  }

  return (
    <>
      <SectionBox title="Request">
        <Paper
          variant="outlined"
          sx={theme => ({
            bgcolor: alpha(theme.palette.primary.main, 0.07),
            borderColor: alpha(theme.palette.primary.main, 0.55),
            borderWidth: 2,
            p: { xs: 2, sm: 2.5 },
          })}
        >
          <Stepper activeStep={activeStep} alternativeLabel>
            <Step>
              <StepLabel optional={<Typography variant="caption">Formal information</Typography>}>
                Setup
              </StepLabel>
            </Step>
            <Step>
              <StepLabel optional={<Typography variant="caption">Template-specific</Typography>}>
                Template Parameters
              </StepLabel>
            </Step>
          </Stepper>
        </Paper>
      </SectionBox>

      {activeStep === 0 ? (
        <SectionBox title="Setup">
          <Stack gap={3}>
            <Paper
              variant="outlined"
              sx={theme => ({
                bgcolor: alpha(theme.palette.info.main, 0.08),
                borderColor: alpha(theme.palette.info.main, 0.55),
                borderWidth: 2,
                p: 2.5,
              })}
            >
              <Stack gap={2}>
                <ResourcePermitTemplateIdentity template={template} />
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Chip label={`${templateApprovalMode(template)} approval`} color="info" />
                  {template.spec?.defaultDuration && (
                    <Chip
                      label={`Default duration: ${template.spec.defaultDuration}`}
                      variant="outlined"
                    />
                  )}
                  {template.spec?.maxDuration && (
                    <Chip label={`Maximum: ${template.spec.maxDuration}`} variant="outlined" />
                  )}
                </Stack>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ borderWidth: 2, p: { xs: 2, sm: 3 } }}>
              <Stack gap={2.75}>
                <Typography fontWeight={700} variant="subtitle1">
                  Formal request information
                </Typography>
                <TextField
                  disabled={Boolean(namespaceError) || namespaceOptions.length === 0}
                  error={Boolean(errors.namespace || namespaceError)}
                  fullWidth
                  helperText={
                    namespaceError
                      ? 'Visible Namespaces could not be loaded. Check Namespace list access.'
                      : !visibleNamespaces
                      ? 'Loading visible Namespaces…'
                      : namespaceOptions.length === 0
                      ? 'No Namespaces are visible to this account.'
                      : errors.namespace
                  }
                  label="Namespace"
                  onChange={event => setNamespace(event.target.value)}
                  required
                  select
                  value={namespaceOptions.includes(namespace) ? namespace : ''}
                >
                  {namespaceOptions.map(option => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
                <Box
                  sx={theme => ({
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    border: 1,
                    borderColor: alpha(theme.palette.primary.main, 0.35),
                    borderRadius: 1,
                    p: 2,
                  })}
                >
                  <Stack gap={1.5}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={generateName}
                          onChange={event => setGenerateName(event.target.checked)}
                        />
                      }
                      label="Generate a unique request name"
                    />
                    <TextField
                      error={Boolean(errors.name)}
                      fullWidth
                      helperText={
                        errors.name ||
                        (generateName
                          ? `Kubernetes will append a unique suffix to ${
                              name.trim() || 'this prefix'
                            }-.`
                          : 'Use a stable DNS-compatible name, or enable generated naming above.')
                      }
                      label={generateName ? 'ResourcePermit name prefix' : 'ResourcePermit name'}
                      onChange={event => setName(event.target.value)}
                      required
                      value={name}
                    />
                  </Stack>
                </Box>
                <TextField
                  error={Boolean(errors.reason)}
                  fullWidth
                  helperText="Optional. Recorded in the ResourcePermit audit trail."
                  label="Reason"
                  minRows={4}
                  multiline
                  onChange={event => setReason(event.target.value)}
                  value={reason}
                />
                <TextField
                  fullWidth
                  helperText="Leave blank for unlimited access without an expiration timestamp."
                  label="Duration"
                  onChange={event => setDuration(event.target.value)}
                  placeholder="For example: 1h"
                  value={duration}
                />
                <TextField
                  error={Boolean(errors.startTime)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  helperText={errors.startTime || 'Optional future activation time.'}
                  label="Start time"
                  onChange={event => setStartTime(event.target.value)}
                  type="datetime-local"
                  value={startTime}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="flex-end">
                  <Button
                    onClick={() => previewYaml(values)}
                    size="large"
                    startIcon={<Icon icon="mdi:file-code-outline" />}
                    variant="outlined"
                  >
                    View YAML
                  </Button>
                  <Button
                    endIcon={<Icon icon="mdi:arrow-right" />}
                    onClick={continueToParameters}
                    size="large"
                    variant="contained"
                    sx={{ minWidth: 210 }}
                  >
                    Template Parameters
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </SectionBox>
      ) : (
        <SectionBox title="Template Parameters">
          <Stack gap={2.5}>
            <Paper
              variant="outlined"
              sx={theme => ({
                bgcolor: alpha(theme.palette.info.main, 0.07),
                borderColor: alpha(theme.palette.info.main, 0.5),
                p: 2,
              })}
            >
              <ResourcePermitTemplateIdentity compact template={template} />
            </Paper>
            <Form
              formContext={{ cluster, requestNamespace: namespace }}
              formData={values}
              liveValidate={false}
              noHtml5Validate
              onChange={({ formData }) => {
                setValues(formData);
                if (formError) setFormError('');
              }}
              onError={validationErrors =>
                setFormError(
                  `Fix ${validationErrors.length} schema validation ${
                    validationErrors.length === 1 ? 'error' : 'errors'
                  } before creating the request.`
                )
              }
              onSubmit={({ formData }) => void submit(formData)}
              schema={paramSchema}
              showErrorList={false}
              uiSchema={uiSchema}
              validator={resourcePermitSchemaValidator}
              widgets={{ [KUBERNETES_RESOURCE_WIDGET]: KubernetesResourceSchemaWidget }}
            >
              <Stack gap={2.5}>
                {formError && <Alert severity="error">{formError}</Alert>}
                <Paper variant="outlined" sx={{ borderWidth: 2, p: 2.5 }}>
                  <Stack gap={2}>
                    <Stack direction={{ xs: 'column-reverse', sm: 'row' }} gap={1.5}>
                      <Button
                        disabled={submitting}
                        onClick={() => setActiveStep(0)}
                        startIcon={<Icon icon="mdi:arrow-left" />}
                        type="button"
                        variant="outlined"
                      >
                        Back to Setup
                      </Button>
                      <Button
                        disabled={submitting}
                        onClick={() => previewYaml(values)}
                        startIcon={<Icon icon="mdi:file-code-outline" />}
                        type="button"
                        variant="outlined"
                      >
                        View YAML
                      </Button>
                      <Button
                        disabled={submitting}
                        startIcon={
                          submitting ? (
                            <CircularProgress color="inherit" size={18} />
                          ) : (
                            <Icon icon="mdi:shield-plus-outline" />
                          )
                        }
                        type="submit"
                        variant="contained"
                        sx={{ flex: 1 }}
                      >
                        Create ResourcePermit
                      </Button>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      The authenticated Kubernetes identity is injected as the requestor by the
                      admission webhook.
                    </Typography>
                  </Stack>
                </Paper>
              </Stack>
            </Form>
          </Stack>
        </SectionBox>
      )}
      <ResourcePermitYamlDialog
        onClose={() => setYamlResource(null)}
        open={Boolean(yamlResource)}
        resource={yamlResource || {}}
      />
    </>
  );
}

export function CreateResourcePermit({
  cluster,
  namespaces,
}: {
  cluster?: string;
  namespaces: string[];
}) {
  const namespaceScope = namespaces.length ? namespaces : undefined;
  const [globalTemplates, globalError] = GlobalResourcePermitTemplate.useList({ cluster });
  const [namespacedTemplates, namespacedError] = ResourcePermitTemplate.useList({
    cluster,
    namespace: namespaceScope,
  });
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const availableTemplates = useMemo(
    (): SelectableResourcePermitTemplate[] =>
      [
        ...(namespacedTemplates || [])
          .filter(
            template =>
              namespaces.length === 0 || namespaces.includes(template.getNamespace() || '')
          )
          .map(template => ({
            key: templateCatalogKey(
              'ResourcePermitTemplate',
              template.getNamespace(),
              template.getName()
            ),
            kind: 'ResourcePermitTemplate' as const,
            namespace: template.getNamespace(),
            template,
          })),
        ...(globalTemplates || []).map(template => ({
          key: templateCatalogKey('GlobalResourcePermitTemplate', undefined, template.getName()),
          kind: 'GlobalResourcePermitTemplate' as const,
          namespace: undefined,
          template,
        })),
      ].sort(
        (left, right) =>
          left.template.getName().localeCompare(right.template.getName()) ||
          left.kind.localeCompare(right.kind) ||
          String(left.namespace || '').localeCompare(String(right.namespace || ''))
      ),
    [globalTemplates, namespacedTemplates, namespaces]
  );
  const availableTags = useMemo(
    () =>
      [
        ...new Set(availableTemplates.flatMap(({ template }) => capsuleResourceTags(template))),
      ].sort((left, right) => left.localeCompare(right)),
    [availableTemplates]
  );
  const filteredTemplates = useMemo(
    () => filterResourcePermitTemplates(availableTemplates, search, selectedTags),
    [availableTemplates, search, selectedTags]
  );
  const templateGroups = useMemo(
    () => groupResourcePermitTemplates(filteredTemplates),
    [filteredTemplates]
  );
  const selectedTemplate = availableTemplates.find(
    template => template.key === selectedTemplateKey
  );
  const loading = !globalTemplates && !globalError && !namespacedTemplates && !namespacedError;
  const unavailable = [
    globalError ? 'GlobalResourcePermitTemplate' : '',
    namespacedError ? 'ResourcePermitTemplate' : '',
  ].filter(Boolean);

  return (
    <>
      <SectionBox title="New ResourcePermit">
        <Paper
          variant="outlined"
          sx={theme => ({
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            borderColor: alpha(theme.palette.primary.main, 0.55),
            borderWidth: 2,
            p: { xs: 2, sm: 3 },
          })}
        >
          <Typography fontWeight={700} variant="subtitle1">
            Choose an access template
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2.5, mt: 0.5 }}>
            Filter the catalog, then select the card describing the access you need. Its schema
            supplies the fields on the second step.
          </Typography>
          {globalError && namespacedError ? (
            <Alert severity="error">
              Request templates are unavailable. This account needs list access to either
              ResourcePermitTemplates in the selected Namespace scope or
              GlobalResourcePermitTemplates.
            </Alert>
          ) : loading ? (
            <CircularProgress size={20} />
          ) : availableTemplates.length === 0 ? (
            <Alert severity="info">
              No readable request templates were found in the selected Namespace scope.
            </Alert>
          ) : (
            <Stack gap={2.5}>
              {unavailable.length > 0 && (
                <Alert severity="info">
                  {unavailable.join(' and ')} could not be listed. Templates returned by the
                  readable API remain selectable.
                </Alert>
              )}
              <Autocomplete
                multiple
                onChange={(_event, value) => setSelectedTags(value)}
                options={availableTags}
                renderInput={params => (
                  <TextField
                    {...params}
                    helperText="Select multiple tags to require every selected tag."
                    label="Filter by tags"
                    placeholder={selectedTags.length === 0 ? 'All tags' : undefined}
                  />
                )}
                value={selectedTags}
              />
              <TextField
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon icon="mdi:magnify" />
                    </InputAdornment>
                  ),
                }}
                label="Search templates"
                onChange={event => setSearch(event.target.value)}
                placeholder="Name, description, or tag"
                value={search}
              />

              {templateGroups.length === 0 ? (
                <Alert severity="info">
                  No templates match the current search and tag filters.
                </Alert>
              ) : (
                <Stack gap={3}>
                  {templateGroups.map(group => (
                    <Box key={group.category}>
                      <Stack
                        alignItems="center"
                        direction="row"
                        gap={1}
                        justifyContent="space-between"
                        sx={{ mb: 1.25 }}
                      >
                        <Stack alignItems="center" direction="row" gap={0.75}>
                          <Icon icon="mdi:tag-outline" />
                          <Typography fontWeight={700} variant="subtitle1">
                            {group.category}
                          </Typography>
                        </Stack>
                        <Chip
                          label={`${group.templates.length} template${
                            group.templates.length === 1 ? '' : 's'
                          }`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                      <Box
                        sx={{
                          display: 'grid',
                          gap: 1.5,
                          gridTemplateColumns: {
                            xs: 'minmax(0, 1fr)',
                            md: 'repeat(2, minmax(0, 1fr))',
                          },
                        }}
                      >
                        {group.templates.map((entry: SelectableResourcePermitTemplate) => {
                          const { kind, namespace: templateNamespace, template } = entry;
                          const name = template.getName();
                          const selected = selectedTemplateKey === entry.key;
                          const tags = capsuleResourceTags(template);
                          return (
                            <Card
                              key={entry.key}
                              variant="outlined"
                              sx={theme => ({
                                borderColor: selected
                                  ? theme.palette.primary.main
                                  : theme.palette.divider,
                                borderWidth: selected ? 2 : 1,
                                height: '100%',
                              })}
                            >
                              <CardActionArea
                                aria-label={`Select template ${name}`}
                                aria-pressed={selected}
                                onClick={() => setSelectedTemplateKey(entry.key)}
                                sx={{ height: '100%' }}
                              >
                                <CardContent sx={{ height: '100%' }}>
                                  <Stack gap={1.5} height="100%">
                                    <ResourcePermitTemplateIdentity template={template} />
                                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                                      {tags.map((tag, index) => (
                                        <Chip
                                          key={tag}
                                          color={index === 0 ? 'primary' : 'default'}
                                          label={tag}
                                          size="small"
                                          variant={index === 0 ? 'filled' : 'outlined'}
                                        />
                                      ))}
                                      {tags.length === 0 && (
                                        <Chip
                                          label="Uncategorized"
                                          size="small"
                                          variant="outlined"
                                        />
                                      )}
                                    </Stack>
                                    <Stack
                                      alignItems="center"
                                      direction="row"
                                      flexWrap="wrap"
                                      gap={0.75}
                                      sx={{ mt: 'auto' }}
                                    >
                                      <Chip
                                        label={`${templateApprovalMode(template)} approval`}
                                        size="small"
                                        variant="outlined"
                                      />
                                      <Chip
                                        color={
                                          kind === 'ResourcePermitTemplate' ? 'secondary' : 'info'
                                        }
                                        label={
                                          kind === 'ResourcePermitTemplate'
                                            ? `Namespace: ${templateNamespace}`
                                            : 'Global template'
                                        }
                                        size="small"
                                        variant="outlined"
                                      />
                                      {selected && (
                                        <Chip
                                          color="success"
                                          icon={<Icon icon="mdi:check" />}
                                          label="Selected"
                                          size="small"
                                        />
                                      )}
                                    </Stack>
                                  </Stack>
                                </CardContent>
                              </CardActionArea>
                            </Card>
                          );
                        })}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          )}
        </Paper>
      </SectionBox>
      {selectedTemplate && (
        <ResourcePermitSetupForm
          key={selectedTemplate.key}
          cluster={cluster}
          namespaces={namespaces}
          templateKind={selectedTemplate.kind}
          templateName={selectedTemplate.template.getName()}
          templateNamespace={selectedTemplate.namespace}
        />
      )}
    </>
  );
}

export default CreateResourcePermit;
