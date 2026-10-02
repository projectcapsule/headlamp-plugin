# headlamp-plugins

Headlamp Plugins for Project Capsule

[![GitHub Release](https://img.shields.io/github/v/release/projectcapsule/headlamp-plugin?include_prereleases&sort=semver)](https://github.com/projectcapsule/headlamp-plugin/releases)
[![License](https://img.shields.io/github/license/projectcapsule/headlamp-plugin)](https://github.com/projectcapsule/headlamp-plugin/blob/main/LICENSE)

A [Headlamp](https://headlamp.dev/) plugin for [Capsule](https://projectcapsule.dev/) — the Kubernetes multi-tenancy operator.

The plugin brings first-class multi-tenancy awareness to the Headlamp UI, including tenant-scoped navigation, rich tenant metadata, quota visualization, and visibility into what resources are being replicated by Capsule.

## Features

- **Tenant Switcher** — Multi-select tenant chooser in the app bar that scopes the entire UI to the selected tenants' namespaces.
- **Tenant Views** — Full list and detail pages for Tenants, including owners, state, namespace lists, and rich metadata (icon, description, links, banner) via annotations.
- **Capsule Overview** — Responsive Tenant, Quotas, and Replications rows for
  Tenants, managed namespaces, TenantOwners, ResourcePools, CustomQuotas,
  GlobalCustomQuotas, GlobalResourceQuotas, TenantResources,
  GlobalTenantResources, and replicated objects.
- **Custom Quotas** — Dedicated list and detail views for both `CustomQuota` and `GlobalCustomQuota`, with usage pies, claims breakdown, and source definitions.
- **Global Resource Quotas** — Dedicated cluster-wide quota list with per-resource capacity health, plus aggregate and per-namespace consumption details in an animated relationship graph.
- **Native CRD Integration** — Opening supported Capsule objects from Headlamp's Custom Resources navigation uses the same rich plugin overviews and details, with canonical CR instance URLs rather than parallel pages.
- **Contextual Documentation** — Tenant, quota, ResourcePool, and replication detail headers include a documentation action directly beside Edit.
- **Tenant Resources** — Powerful support for `TenantResource` and `GlobalTenantResource`:
  - Animated replication diagrams linking each TR/GTR to its managed objects
  - Grouped tables of managed objects
  - "Defined Resources" view (supports legacy + modern `namespacedItems` / `rawItems` / `generators`)
  - Click-through, theme-aware Server-Side Apply (SSA) ownership diffs
  - One-click force reconcile action
- **Readiness Visualization** — Consistent use of colored status indicators and small pie charts for readiness of namespaces, quotas, and managed objects.
- **Scoped Filtering** — Automatic namespace filter updates when navigating from tenant-owned resources.

## Installation

### Plugin Manager (Recommended - In-Cluster)

Enable the pluginmanager along with the release of headlamp and add the capsule-plugin as entry:

```yaml
pluginsManager:
  enabled: true
  configContent: |
    plugins:
      - name: capsule
        source: https://artifacthub.io/packages/headlamp/headlamp-capsule/capsule
        version: 0.1.0-beta1
    installOptions:
      parallel: true
      maxConcurrent: 2
```

### Using a Release (Recommended - Client)

1. Download the latest `capsule-plugin-*.tar.gz` from the [Releases](https://github.com/projectcapsule/headlamp-plugin/releases) page.
2. Open Headlamp.
3. Go to **Settings → Plugins → Load plugin from file** and select the downloaded archive.
4. The **Capsule** section will appear in the sidebar.

### Development environment

See the [Development](#development) section below for the in-cluster workflow.

### Documentation URL

Documentation actions use `https://projectcapsule.dev` by default. To use a
mirror or another documentation host, open **Settings → Plugins → capsule**, set
**Documentation base URL**, and save. The resource-specific `/docs/...` path and
anchor are appended to the configured base URL.

The same plugin settings page includes **Shareable section links**. These
fragment-link buttons are enabled by default in the web app and disabled by
default in Headlamp Desktop, where URL hashes are used for routing. The switch
can explicitly override either default.

## Capsule Metadata Annotations

You can enrich how Capsule resources appear in the plugin with `info.projectcapsule.dev`
annotations. Tags work on every supported Capsule resource. Icon and description catalog
metadata works for `Tenant`, `ResourcePermitTemplate`, and `GlobalResourcePermitTemplate`; links and
banners remain Tenant-specific.

| Annotation                            | Applies to                      | Purpose                                      | Example Value                                                                   |
| ------------------------------------- | ------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| `info.projectcapsule.dev/icon`        | Tenant, both template kinds     | Avatar/icon shown in plugin catalog surfaces | `mdi:shield-key-outline`                                                        |
| `info.projectcapsule.dev/description` | Tenant, both template kinds     | Short description shown in lists and chooser | `Temporary production diagnostics`                                              |
| `info.projectcapsule.dev/tags`        | All supported Capsule resources | Comma-separated, clickable inventory tags    | `production, security, elevated-access`                                         |
| `info.projectcapsule.dev/links`       | Tenant                          | JSON links with per-link icons               | `'[{"title":"Dashboard","url":"https://...","icon":"fa-solid fa-chart-line"}]'` |
| `info.projectcapsule.dev/banner`      | Tenant                          | Banner image at the top of the tenant detail | `https://example.com/tenant-banner.jpg`                                         |

**Example:**

```yaml
apiVersion: capsule.clastix.io/v1beta2
kind: Tenant
metadata:
  name: payments
  annotations:
    info.projectcapsule.dev/icon: https://example.com/payments-icon.png
    info.projectcapsule.dev/description: Production tenant for the payments team
    info.projectcapsule.dev/tags: production, payments, customer-facing
    info.projectcapsule.dev/links: '[{"title":"Grafana","url":"https://grafana.example.com/d/payments","icon":"fa-solid fa-chart-line"},{"title":"Runbook","url":"https://wiki.example.com/payments-runbook","icon":"fa-regular fa-file-lines"}]'
    info.projectcapsule.dev/banner: https://example.com/payments-banner.jpg
spec:
  owners:
    - kind: Group
      name: payments-team
```

Tenant catalog annotations are used in the tenant chooser, tenant lists, tenant details, and the
Capsule overview. Tags are trimmed, empty entries are ignored, and duplicate entries are shown
once. Every tag is a link: selecting one opens a right-side Headlamp tab containing all visible
Capsule resources with the exact same tag. Results are permission-aware, so an unavailable API
does not hide matches returned by other readable Capsule APIs.
When `info.projectcapsule.dev/icon` is absent, Tenant surfaces use the official
[CNCF Capsule color icon](https://github.com/cncf/artwork/tree/main/projects/capsule/icon/color)
instead of generated initials.
When one or more specific Tenants are selected, Headlamp also shows a secondary
context-tab row below the app bar. Each selected Tenant gets a tab (including
its configured icon), and the active tab exposes that Tenant's quick links. The
row is hidden when **No Tenant Filter** is selected. This empty selection clears
the global Namespace filter, so non-Tenant namespaces may also be visible; it
does not mean “all Tenants.”

> **Note:** The `links` annotation must be a valid JSON array of objects
> containing at least `title` and `url`. Every object may define its own `icon`
> as Font Awesome CSS classes (`fa-solid fa-chart-line`, `fas fa-chart-line`,
> `far fa-file`, or `fab fa-github`), an Iconify name such as
> `fa6-solid:chart-line`/`mdi:grafana`, or an HTTP(S)/relative image URL. The
> Tenant-level `info.projectcapsule.dev/icon` annotation accepts the same forms.
> Set `favicon: true` (or `icon: "favicon"`) to derive
> `<link-origin>/favicon.ico`, or provide an explicit favicon URL as the
> `favicon` value. The icon appears with that link in Tenant lists, details, and
> the selected Tenant context bar.

### ResourcePermit template catalog metadata

Open **Tenants → Permits** for Requests and Templates. New requests use a generated
name prefix by default, accept an optional Reason, and open their detail page
immediately after creation. Reviews highlight archive retention or immediate
deletion after expiry. Denied details retain the future Archiving marker even
when the controller has not yet reported a deletion date.

This UI uses Capsule's `capsule.clastix.io/v1beta2` ResourcePermit APIs:
`resourcepermits`, `resourcepermittemplates`, and `globalresourcepermittemplates`.
Install the matching CRDs and update applicable Capsule Proxy policies when
upgrading the backend. CLI snippets use `kubectl capsule resource-permit`.

Both namespaced `ResourcePermitTemplate` and cluster-scoped `GlobalResourcePermitTemplate` use the
same icon and description annotations as Tenants. The plugin shows them in template tables,
template details, and the first step of the New ResourcePermit flow. That flow combines readable
local and global templates, provides free-text search and a multi-select tag filter, and requires
every selected tag to match. Template cards are grouped by the first declared tag, while remaining
tags remain filterable. Templates without tags appear under **Uncategorized**. Templates also
support the shared tags annotation. In both Setup and Template Parameters, **View YAML** optionally
opens the exact current ResourcePermit manifest in an application dialog where it can be copied or
downloaded without creating the request:

```yaml
apiVersion: capsule.clastix.io/v1beta2
kind: ResourcePermitTemplate
metadata:
  name: production-diagnostics
  namespace: solar-prod
  annotations:
    info.projectcapsule.dev/icon: mdi:shield-search
    info.projectcapsule.dev/description: Temporary read access for production diagnostics
    info.projectcapsule.dev/tags: production, diagnostics, break-glass
spec:
  approvals:
    approvers:
      - kind: Group
        name: production-approvers
  defaultDuration: 1h
  maxDuration: 4h
  resources:
    - policy:
        creation: Owner
        deletion: Remove
        protect: true
      targets:
        - apiVersion: rbac.authorization.k8s.io/v1
          kind: Role
          metadata:
            name: production-diagnostics
          rules:
            - apiGroups: ['']
              resources: [pods, pods/log]
              verbs: [get, list]
```

Icon values may be Iconify names, Font Awesome classes, or safe HTTP(S)/relative image URLs,
using the same formats described above for Tenant icons.

### EventHub

The Capsule bell in Headlamp's top bar opens the live, user-specific **EventHub**. It resolves the
signed-in Kubernetes username and groups with `SelfSubjectReview`. Requestors receive only
`Active`, `Approved`, `Denied`, and `Expired` transitions for their own ResourcePermits. Explicitly
configured manual reviewers receive only the `Requested` transition. Each entry includes its
message, actor, occurrence time, and a link to the request; an actionable review request also
offers the existing right-side **Review** activity.

Only the latest appended transition for each ResourcePermit is considered. The relative-timeframe
selector at the top filters both audiences to the last hour, 24 hours, 7 days, 30 days, or all
time. The default is 24 hours. The adjacent event-type selector shows all events, only **Action
required** reviewer requests, or only **Informational** requestor transitions. Actor identities
link to the corresponding Subject activity.

The EventHub first lists ResourcePermits across all Namespaces permitted by Headlamp, independently
of the page's current Namespace filter, so reviewers do not miss actionable requests outside the
selected scope. If that all-Namespaces request is forbidden, it falls back to the active Namespace
filter or the Permits `?namespace=` query for restricted Tenant users. RBAC and list failures are
displayed in the feed instead of being presented as an empty result.

#### Kubernetes resource form fields

A template parameter can use Capsule's `x-capsule-form` extension inside its JSON Schema 2020-12
schema to load choices from an arbitrary Kubernetes GVK. Headlamp discovers the Kind's API
resource, lists it with the signed-in user's permissions, and stores the rendered `valueTemplate`
when the user selects the rendered `labelTemplate`:

```yaml
spec:
  paramSchema:
    type: object
    required: [clusterRole]
    properties:
      clusterRole:
        type: string
        description: ClusterRole to distribute temporarily
        x-capsule-form:
          widget: kubernetes-resource
          source:
            apiVersion: rbac.authorization.k8s.io/v1
            kind: ClusterRole
            labelSelector: projectcapsule.dev/eligible=true
          option:
            labelTemplate: '{{ .metadata.name }}'
            valueTemplate: '{{ .metadata.name }}'
```

Put the extension on an array's item schema to render a multi-select whose submitted value remains
a JSON string array:

```yaml
spec:
  paramSchema:
    type: object
    required: [clusterRoles]
    properties:
      clusterRoles:
        type: array
        minItems: 1
        uniqueItems: true
        items:
          type: string
          x-capsule-form:
            widget: kubernetes-resource
            source:
              apiVersion: rbac.authorization.k8s.io/v1
              kind: ClusterRole
```

The extension is also discovered through nested objects and arrays, composition/conditional
keywords, and local `$defs`/`$ref` references. Other schema behavior—including required fields,
defaults, enums, item bounds, uniqueness, and `oneOf`/`anyOf`/`allOf`—continues to be handled by
the JSON Schema form and Ajv 2020 validator. `x-kubernetes-validations` is retained as an opaque
server-side keyword; admission validation errors are displayed if Kubernetes rejects the request.

For namespaced GVKs, `source.namespace` may be `request`, `*`, or a literal Namespace. Omitting it
uses the ResourcePermit Namespace; cluster-scoped GVKs are always listed at cluster scope. Optional
`labelSelector` and `fieldSelector` values are forwarded to Kubernetes. Both option templates
default to `{{ .metadata.name }}` and may combine static text with safe object paths, for example
`{{ .metadata.name }} ({{ .metadata.namespace }})`. Discovery and list failures—including RBAC
denials—are shown on the field without breaking the remaining form.

## TenantResources & GlobalTenantResources

The plugin provides rich support for Capsule's replication resources:

- Visual breakdown of what each `TenantResource` / `GlobalTenantResource` is configured to replicate.
- Animated flow from each replication resource to its live managed objects.
- Inline SSA ownership diff when a managed object is selected in the flow or inventory.
- Live view of the actual objects that have been applied (with SSA ownership information).
- Ability to trigger reconciliation directly from the UI.
- Support for both the modern `resources` array format and older flat resource definitions.

## Development

### In-cluster development (recommended)

The repository includes a repeatable environment that deploys Headlamp and the
locally built plugin into Kubernetes. It is optimized for kind and uses the
current kube context by default.

If the Capsule playground has already installed Headlamp through Flux, reload
the local bundle into that installation directly:

```bash
make headlamp-playground-reload
make headlamp-playground-status
```

This suspends only the Headlamp HelmRelease, injects the bundle into its shared
plugin volume, and restarts only the Headlamp container. Return ownership to
Flux afterward with `make headlamp-playground-resume`. See
[`deploy/headlamp/README.md`](deploy/headlamp/README.md) for lifecycle details
and overrides.

Prerequisites:

- Node.js 22 or 24 (pinned by `.nvmrc`/`.node-version`) and npm 11+
- Docker, kubectl, Helm, and kind
- A Kubernetes cluster with Capsule CRDs installed
- At least one `Tenant` that your user can list

### Getting Started

```bash
git clone https://github.com/projectcapsule/headlamp-plugin.git
cd headlamp-plugin
npm install
```

Deploy or update Headlamp and the plugin:

```bash
make headlamp-deploy
```

Keep the port-forward running, then open <http://127.0.0.1:8081>:

```bash
make headlamp-port-forward
```

Generate a temporary token in another terminal and use it on Headlamp's login
screen:

```bash
make headlamp-token
```

For the normal edit/build/reload loop, change files under `src/` and run:

```bash
make headlamp-sync
```

Headlamp remains in-cluster while the rebuilt bundle is copied into its watched
plugin directory. See [`deploy/headlamp/README.md`](deploy/headlamp/README.md)
for configuration overrides, diagnostics, remote-cluster usage, and the local
development RBAC warning.

### Standalone plugin server

`npm start` still starts the plugin development server on port `4466`. Use this
when running Headlamp Desktop or Headlamp from source and load the plugin from
`http://localhost:4466`.

### Build & Package

```bash
npm run build
npm run package
```

The production build uses the repository's `vite.config.mjs`, which retains
Headlamp's shared-library setup while making the RJSF JSON Schema renderer's
MUI and lodash-es submodule imports compatible with Headlamp 0.44.

This produces a `.tar.gz` file in the root that can be loaded via **Settings → Plugins → Load plugin from file**.

### Testing

```bash
npm test
```

### Other useful commands

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `npm run build`     | Production build                     |
| `npm run lint`      | Lint the project                     |
| `npm run lint-fix`  | Auto-fix lint issues                 |
| `npm run tsc`       | Type check                           |
| `npm run storybook` | Run Storybook (if stories are added) |

## Related Projects

- [Capsule](https://github.com/projectcapsule/capsule) — The Kubernetes multi-tenancy operator
- [Headlamp](https://github.com/kubernetes-sigs/headlamp) — An extensible Kubernetes UI

## Contributing

Contributions are welcome! Please open an issue or pull request on [GitHub](https://github.com/projectcapsule/headlamp-plugin).

When contributing, please:

- Run `npm run lint` and `npm run build` before submitting
- Add or update tests for new helper functions or complex logic
- Keep the modular structure (components are grouped under `tenants/`, `quotas/`, `tenant-resources/`, etc.)

## License

Apache-2.0

---

Made with ❤️ for the Capsule and Headlamp communities.
