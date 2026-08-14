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

## Tenant Metadata Annotations

You can enrich how Tenants appear in the plugin by adding annotations to your `Tenant` resources.

| Annotation                            | Purpose                                      | Example Value                                   |
| ------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| `info.projectcapsule.dev/icon`        | Avatar/icon for the tenant                   | `https://example.com/my-tenant-icon.png`        |
| `info.projectcapsule.dev/description` | Short description shown in lists and chooser | `Production tenant for the payments team`       |
| `info.projectcapsule.dev/links`       | JSON array of quick links                    | `'[{"title":"Dashboard","url":"https://..."}]'` |
| `info.projectcapsule.dev/banner`      | Banner image at the top of the tenant detail | `https://example.com/tenant-banner.jpg`         |

**Example:**

```yaml
apiVersion: capsule.clastix.io/v1beta2
kind: Tenant
metadata:
  name: payments
  annotations:
    info.projectcapsule.dev/icon: https://example.com/payments-icon.png
    info.projectcapsule.dev/description: Production tenant for the payments team
    info.projectcapsule.dev/links: '[{"title":"Grafana","url":"https://grafana.example.com/d/payments"},{"title":"Runbook","url":"https://wiki.example.com/payments-runbook"}]'
    info.projectcapsule.dev/banner: https://example.com/payments-banner.jpg
spec:
  owners:
    - kind: Group
      name: payments-team
```

These annotations are used in the tenant chooser, tenant lists, tenant details, and the Capsule overview.
When one or more specific Tenants are selected, Headlamp also shows a secondary
context-tab row below the app bar. Each selected Tenant gets a tab (including
its configured icon), and the active tab exposes that Tenant's quick links. The
row is hidden for the unscoped **All Tenants** selection.

> **Note:** The `links` annotation must be a valid JSON array of objects containing at least `title` and `url`.

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
