# headlamp-plugins
Headlamp Plugins for Project Capsule

[![GitHub Release](https://img.shields.io/github/v/release/projectcapsule/headlamp-plugin?include_prereleases&sort=semver)](https://github.com/projectcapsule/headlamp-plugin/releases)
[![License](https://img.shields.io/github/license/projectcapsule/headlamp-plugin)](https://github.com/projectcapsule/headlamp-plugin/blob/main/LICENSE)

A [Headlamp](https://headlamp.dev/) plugin for [Capsule](https://projectcapsule.dev/) — the Kubernetes multi-tenancy operator.

The plugin brings first-class multi-tenancy awareness to the Headlamp UI, including tenant-scoped navigation, rich tenant metadata, quota visualization, and visibility into what resources are being replicated by Capsule.

## Features

- **Tenant Switcher** — Multi-select tenant chooser in the app bar that scopes the entire UI to the selected tenants' namespaces.
- **Tenant Views** — Full list and detail pages for Tenants, including owners, state, namespace lists, and rich metadata (icon, description, links, banner) via annotations.
- **Capsule Overview** — At-a-glance dashboard with tenant activity, readiness of managed namespaces, Global Quotas, TenantResources, and replicated objects.
- **Custom Quotas** — Dedicated list and detail views for both `CustomQuota` and `GlobalCustomQuota`, with usage pies, claims breakdown, and source definitions.
- **Tenant Resources** — Powerful support for `TenantResource` and `GlobalTenantResource`:
  - Grouped tables of managed objects
  - "Defined Resources" view (supports legacy + modern `namespacedItems` / `rawItems` / `generators`)
  - Server-Side Apply (SSA) managed fields inspection
  - One-click force reconcile action
- **Readiness Visualization** — Consistent use of colored status indicators and small pie charts for readiness of namespaces, quotas, and managed objects.
- **Scoped Filtering** — Automatic namespace filter updates when navigating from tenant-owned resources.

## Installation

### Using a Release (recommended)

1. Download the latest `capsule-plugin-*.tar.gz` from the [Releases](https://github.com/projectcapsule/headlamp-plugin/releases) page.
2. Open Headlamp.
3. Go to **Settings → Plugins → Load plugin from file** and select the downloaded archive.
4. The **Capsule** section will appear in the sidebar.

### Development / Hot Reload

See the [Development](#development) section below.

## Tenant Metadata Annotations

You can enrich how Tenants appear in the plugin by adding annotations to your `Tenant` resources.

| Annotation                          | Purpose                                      | Example Value                                      |
|-------------------------------------|----------------------------------------------|----------------------------------------------------|
| `info.projectcapsule.dev/icon`      | Avatar/icon for the tenant                   | `https://example.com/my-tenant-icon.png`           |
| `info.projectcapsule.dev/description` | Short description shown in lists and chooser | `Production tenant for the payments team`          |
| `info.projectcapsule.dev/links`     | JSON array of quick links                    | `'[{"title":"Dashboard","url":"https://..."}]'`    |
| `info.projectcapsule.dev/banner`    | Banner image at the top of the tenant detail | `https://example.com/tenant-banner.jpg`            |

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

> **Note:** The `links` annotation must be a valid JSON array of objects containing at least `title` and `url`.

## TenantResources & GlobalTenantResources

The plugin provides rich support for Capsule's replication resources:

- Visual breakdown of what each `TenantResource` / `GlobalTenantResource` is configured to replicate.
- Live view of the actual objects that have been applied (with SSA ownership information).
- Ability to trigger reconciliation directly from the UI.
- Support for both the modern `resources` array format and older flat resource definitions.

## Development

### Prerequisites

- Node.js (v20+ recommended)
- A Kubernetes cluster with Capsule CRDs installed
- Headlamp (desktop app or from source) connected to that cluster
- At least one `Tenant` that your user can list

### Getting Started

```bash
git clone https://github.com/projectcapsule/headlamp-plugin.git
cd headlamp-plugin
npm install
```

### Running in Development Mode

```bash
npm start
```

This starts the development server on port `4466` by default.

Then load the plugin in Headlamp using the **"Load plugin from URL"** feature (point it at `http://localhost:4466`).

> **Important:** The dev server only serves the plugin JavaScript. You must run it against a real Headlamp instance that is connected to a cluster with Capsule.

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

| Command              | Description                          |
|----------------------|--------------------------------------|
| `npm run build`      | Production build                     |
| `npm run lint`       | Lint the project                     |
| `npm run lint-fix`   | Auto-fix lint issues                 |
| `npm run tsc`        | Type check                           |
| `npm run storybook`  | Run Storybook (if stories are added) |

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
>>>>>>> dbeffcd3 (feat: first commit)
