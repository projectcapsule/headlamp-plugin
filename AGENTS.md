# Capsule Headlamp Plugin Agent Guide

## Project

This repository contains the `capsule` plugin for Headlamp. The plugin source is
under `src/` and is built with `@kinvolk/headlamp-plugin` through the npm scripts
in `package.json`.

## Current objective

Progressively develop the Capsule plugin against the reproducible in-cluster
Headlamp environment. The current feature set includes the expanded/aligned
overview, consistently aligned subpages, Capsule-aware resource map grouping,
replication diagrams with inline SSA ownership inspection, and a Tenant detail
flow that visualizes the Tenant-to-Namespace relationship. Capsule Proxy's
optional GlobalProxySettings API is also a first-class overview/menu/detail
surface. CapsuleConfiguration health and effective controller settings are
available under the dedicated Capsule Settings navigation group.

The in-cluster development environment lives under `deploy/headlamp/` and is
orchestrated by `hack/headlamp-dev.sh` plus the root `Makefile`. Keep this file
updated when the workflow, prerequisites, generated resources, or validation
commands change.

## Local environment discovered

- Working directory: `/Users/pariah/Projects/Development/headlamp-plugin`
- System Node.js: v26.5.1 (unsupported by the current plugin toolchain)
- Supported Node.js versions: 22 and 24; `.nvmrc` and `.node-version` pin 24
- npm: 11.17.0
- Available tools: `kubectl`, `helm`, `kind`, and `docker`
- As of 2026-08-19 the main kubeconfig has no current context and contains only
  `admin@cluster-a`, although `kind get clusters` reports the local `capsule`
  cluster. Use a task-specific kubeconfig such as
  `kind export kubeconfig --name capsule --kubeconfig /tmp/headlamp-kind-capsule-kubeconfig`
  rather than silently rewriting the contributor's main kubeconfig.
- The standalone Helm-owned development environment remains available through
  `make headlamp-deploy`, but do not run it over a playground installation
  without explicit direction. Use `make headlamp-playground-reload` once the
  playground's Flux-managed Headlamp HelmRelease exists.
- Other known context: `admin@cluster-a`
- Cluster API access may require running outside the filesystem/network sandbox
  because the kind API is exposed on localhost.
- On 2026-08-11, the `capsule-dynamic-webhook` configuration used a stale direct
  URL (`192.168.0.22:9443`) and blocked all Namespace create/update requests.
  The environment therefore defaults to the existing `capsule-system`
  namespace; the script omits Helm's `--create-namespace` when it already exists.

Do not assume that `kind-capsule` exists for every contributor. Deployment
automation and documentation must allow the kube context and namespace to be
overridden.

## Repository notes

- `npm start` runs the standalone plugin development server on port 4466.
- `npm run build` produces the plugin bundle in `dist/` through the repository's
  `vite.config.mjs`. That configuration extends Headlamp's SDK configuration and
  corrects the shared MUI/lodash-es submodule globals used by RJSF. Keep the
  in-cluster scripts on this configuration; the stock SDK builder emits invalid
  globals such as `IconButtonindex.js` for these imports under Headlamp 0.44.
- The root `Dockerfile` packages the built bundle as files under
  `/plugins/capsule`; it is intended to be used as a plugin init-container image,
  not as a standalone web server.
- The Dockerfile uses pinned, multi-architecture `busybox:1.37.0` as its minimal
  init-container base. Do not restore the previous
  `stagex/core-busybox:latest` source; it fails on ARM64 hosts.
- `.dockerignore` intentionally retains `dist/` and `package.json` for that image.
- The GitHub release workflow builds and publishes the plugin image to GHCR.
- The README documents both the preferred in-cluster loop and the standalone
  plugin server.

## In-cluster development workflow

### Existing Flux playground Headlamp

- `make headlamp-playground-reload` is the fast path for a Headlamp already
  installed by the Capsule playground. It dynamically reads
  `flux-system/headlamp.spec.targetNamespace`, finds the Deployment through its
  Flux ownership labels, and verifies the expected `headlamp` and
  `headlamp-plugin` containers.
- The reload target builds `dist/main.js`, suspends only the Headlamp
  HelmRelease, copies `main.js` and `package.json` into
  `/build/plugins/capsule` through the plugin-manager sidecar, verifies the
  SHA-256, and sends SIGTERM only to PID 1 in the Headlamp server container.
  Kubelet restarts that container while the pod and its shared EmptyDir remain,
  which refreshes Headlamp's plugin cache without losing the injected bundle.
- `make headlamp-playground-status` reports suspension/readiness, workload and
  pod state, the plugin files, and matching local/pod checksums.
- `make headlamp-playground-resume` sets `spec.suspend: false` and requests a
  Flux reconciliation. The current injected bundle stays until a later pod
  rollout recreates the EmptyDir. Do not expect this development injection to
  persist across a Headlamp rollout.
- Defaults are HelmRelease `flux-system/headlamp`, containers `headlamp` and
  `headlamp-plugin`, and plugin path `/build/plugins/capsule`. The script exposes
  overrides for context, Flux/workload namespaces, release/deployment,
  containers, plugin directory/name, and Node binary. See
  `deploy/headlamp/README.md`.

### Standalone Helm-owned Headlamp

- `make headlamp-deploy` builds `dist/main.js`, builds the local plugin image,
  loads it into kind, and installs or upgrades the pinned Headlamp Helm chart.
  The loader falls back to `ctr images import` on each kind node because kind
  v0.31.0 cannot parse the current cluster's containerd v4 configuration.
- `make headlamp-sync` is the fast iteration path: it rebuilds the plugin and
  copies `main.js` and `package.json` through the `plugin-sync` sidecar into the
  shared plugin volume. Headlamp runs with `watchPlugins: true`. This path writes
  to a pod-local `EmptyDir` and is lost when that pod is recreated.
- Always finish a feature batch with `make headlamp-deploy`, even if fast sync
  was already verified. It rebuilds/loads the development image and records the
  bundle hash in a pod annotation so a rollout starts with the current plugin.
  A service port-forward still terminates when its selected pod is replaced;
  restart `make headlamp-port-forward` after the rollout.
- The pod selector in `hack/headlamp-dev.sh` sorts Running development pods by
  creation time and selects the newest. During a rollout, the outgoing pod can
  remain `Running` while terminating; selecting `.items[0]` can therefore sync
  to or report the stale EmptyDir even though the new pod is serving traffic.
- `make headlamp-port-forward` serves Headlamp on `127.0.0.1:8081`.
- The locally running Capsule controller may simultaneously own IPv6
  `[::]:8080`. In that state, `localhost:8080` can resolve to `::1` and return
  the controller's plain `404 page not found`. Use the maintained Headlamp URL
  `http://127.0.0.1:8081` instead.
- `make headlamp-token` creates a temporary token for the development service
  account.
- `make headlamp-status`, `make headlamp-logs`, and `make headlamp-render` are
  the main diagnostics.
- `make headlamp-undeploy` removes the Helm release but preserves its namespace.

The standalone script defaults are the current kube context, namespace `capsule-system`,
release `capsule-headlamp`, plugin image `capsule-headlamp-plugin:dev`, and
Headlamp chart `0.44.0`. On a playground-managed cluster use the separate
playground target instead of installing this release. See
`deploy/headlamp/README.md` for environment overrides and remote-cluster usage.

`hack/headlamp-dev.sh` validates Node before building. It uses `npx node@24`
when the active Node is unsupported; a version manager or `NODE_BIN` override
avoids that fallback. System Node 26 fails in `yargs` before the plugin compiles.

The development service account keeps the chart's built-in `view` binding and
also has a separate development-only `cluster-admin` ClusterRoleBinding named
`capsule-headlamp-cluster-admin`. This is intentionally unrestricted so all
Headlamp actions and cluster-scoped APIs can be exercised in the disposable
development cluster. Never copy this binding to a shared or production cluster;
replace it with API- and verb-scoped roles there.

## Overview dashboard

- `src/components/overview/CapsuleOverview.tsx` renders four semantic summary
  rows: Tenant (3 cards), Quotas (4 cards), Replications (3 cards), and a Proxy row (1 card).
- The twelve dedicated panels are Tenants, Managed Namespaces, Tenant Owners,
  Resource Pools, Custom Quotas, Global Custom Quotas, Global Resource Quotas,
  Tenant Resources, Global Tenant Resources, Managed Resources, and Global
  Proxy Settings.
- `src/components/overview/overviewStats.ts` contains the tested readiness,
  quota-health, and ResourcePool aggregation logic.
- `src/resources/resourcePools.ts` models both cluster-scoped ResourcePools and
  namespaced ResourcePoolClaims; `src/resources/tenantOwners.ts` models the
  cluster-scoped TenantOwner API.
- `src/resources/globalResourceQuotas.ts` models the cluster-scoped
  `GlobalResourceQuota` API, including aggregate totals and per-namespace usage.
- `src/resources/globalProxySettings.ts` models Capsule Proxy's optional,
  cluster-scoped `capsule.clastix.io/v1beta1` GlobalProxySettings API. The
  overview must tolerate a missing CRD and show the Proxy tile as unavailable;
  the static Proxy menu remains useful as an installation/access diagnostic.
- GlobalResourceQuota has dedicated list and detail routes under
  `/capsule/global-resource-quotas/`. The list shows readiness, peak capacity
  health, namespace scope, and exact per-resource used/hard values. The detail
  keeps Conditions and Events together, then shows aggregate usage and an
  animated quota-to-namespace consumption graph from
  `GlobalResourceQuotaFlow.tsx`. CPU and memory quantities must never be summed;
  the peak percentage is only a health signal and exact resource quantities
  remain visible in the graph and tables.
- `src/components/common/SummaryCardGrid.tsx` is the only summary-card layout
  primitive. It provides equal-height CSS-grid rows and responsive 1/2/3/4
  column breakpoints. Use it on overview and list subpages; do not reintroduce
  ad-hoc MUI Grid item widths around `StatCard`.
- `StatCard` owns shared alignment. Its title, visualization, chips, and footer
  have stable layout regions; use `fullHeight` and a stretching parent for
  aligned groups of cards.
- `src/components/common/statCardVisibility.ts` removes zero-value slices and
  numeric status chips before rendering. Do not show misleading empty states
  such as a red `0 Not Ready` chip; chips with non-numeric informational labels
  remain visible.
- Managed-resource `Unknown` status is a separate gray segment and must not be
  counted as Ready.
- Overview `StatCard`s are fully keyboard-accessible, cluster-aware links when
  `routeName` is provided. All twelve overview cards navigate to their dedicated
  plugin page, the Kubernetes Namespaces page, an appropriate generic custom
  resource list, or the all-sources tenant-grouped map for Managed Resources.
- The overview no longer renders the duplicate recent-Tenants table or its
  `View all tenants` footer link. `CapsuleEvents.tsx` is the final overview
  section and lists Events for every involved object in the
  `capsule.clastix.io` API group. Its searchable/filterable table defaults to
  Last Occurrence descending.

## Subpage alignment

- Headlamp's `Resource.DetailsGrid` owns the horizontal page gutter for detail
  views. Custom Capsule subsections must be passed as its children; do not
  render `SectionBox` or `ResourceListView` siblings after a self-closing
  `DetailsGrid`, because those sections start from a different horizontal
  origin.
- `src/components/common/DetailsSectionStack.tsx` is the single-child wrapper
  used inside `DetailsGrid`. It groups multiple Capsule subsections while
  preserving Headlamp's metadata/events grid alignment.
- `src/components/common/AnchoredSectionBox.tsx` adds shareable anchors to
  Capsule subsections. `SectionAnchorLink` reads the reactive
  `sectionAnchorsEnabled` plugin setting. Anchors default on in the web app and
  off in Headlamp Desktop/Electron because Desktop reserves the URL hash for
  routing; do not render an `href="#..."` there unless the user explicitly
  enables **Shareable section links**. It must import `SectionBox` from
  Headlamp's public `CommonComponents` entry point. A deep
  `components/common/SectionBox` import can type-check and bundle successfully
  but is unavailable in Headlamp's browser plugin API, causing every wrapped
  subsection to disappear at runtime.
- This pattern is applied to Tenant, all dedicated quota/ResourcePool pages,
  TenantResource, and GlobalTenantResource detail views. Tenant identity/links,
  scheduling/class information, and its namespace graph are proper `SectionBox`
  subsections.
- List-page summary cards use `SummaryCardGrid` with the `inset` prop so their
  left and right edges match the following Headlamp `ResourceListView`. The
  overview intentionally leaves `inset` disabled because its heading and card
  rows share the top-level page origin. `inset` also adds responsive top padding
  so subpage charts do not crowd Headlamp's page header.
- Do not normally wrap `ResourceListView` in another `SectionBox`;
  `ResourceListView` already creates one. The Tenant Namespaces grid is the
  deliberate exception: its inner list uses `title={null}` so the relationship
  graph and searchable inventory share one visible `Namespaces` heading without
  duplicate title spacing. Its layout is intentionally vertical: the full-width
  Tenant-to-Namespace XYFlow comes first and the searchable Namespace table is
  below it. Do not return this section to the cramped side-by-side grid.
- Editable Capsule `ResourceListView` tables use stable `capsule-*` IDs and the
  standard Headlamp row-actions dropdown. `CapsuleTableEditAuthorization.tsx`
  mounts Headlamp's public `AuthVisible` update check invisibly in each rendered
  Name cell, so the built-in Edit menu item is warmed before the dropdown is
  opened. Do not restore a dedicated Edit column: the expected UX matches the
  Pods table. Events and managed-resource inventory tables remain read-only and
  are deliberately excluded from the prewarm processor.
- `src/components/common/ConditionsAndEvents.tsx` is used by every dedicated
  Capsule detail page, including TenantOwner, all quota/ResourcePool pages, and
  both replication-resource pages. It renders Events immediately with Conditions
  instead of letting `DetailsGrid.withEvents` append them at the page bottom.
  The plugin-owned Events table uses the public Kubernetes Event API and sorts
  newest first. Do not import `ObjectEventList` directly: it is declared by the
  SDK but is undefined in Headlamp's browser plugin API in version 0.44.0.

## Quota aggregation views

- `src/components/common/QuotaAggregationView.tsx` is the shared detail-page
  aggregation UI for GlobalResourceQuota, GlobalCustomQuota, CustomQuota, and
  ResourcePool.
  It owns one resource selector whose default is `All resources`; only one
  specific resource can be selected at a time. The selection filters both the
  aggregate table and the Namespace Consumption table/graph. Both tables
  default to utilization descending; ties use the resource or Namespace name
  ascending so the order remains stable.
- The shared selector is URL-backed with `?resource=<resource-name>`. A valid
  parameter initializes the filtered tables and flow on direct navigation or
  reload. Selecting another resource replaces only this parameter and preserves
  unrelated query state; selecting `All resources` removes it. Missing or stale
  values safely render the all-resource view.
- Tenant details have their own `TenantQuotaOverview` and `TenantQuotaFlow`.
  They discover GlobalResourceQuota, ResourcePool, GlobalCustomQuota, and
  CustomQuota objects carrying the exact metadata label
  `projectcapsule.dev/tenant=<tenant-name>`; the legacy Namespace ownership
  label is intentionally not a fallback. The allocation selector uses the same
  shareable `?resource=` contract, filters the animated Tenant-to-quota flow and
  per-resource usage table together, and the usage table defaults to highest
  utilization. Keep the graph full width and the table beneath it.
- `src/components/common/QuotaConsumptionFlow.tsx` is the shared animated
  quota-to-Namespace XYFlow. In all-resource mode, badges and edges show the
  highest independently calculated utilization. In single-resource mode, every
  percentage badge and edge color is calculated only from that selected
  resource. Edges intentionally have no text labels: labels first rendered with
  opaque black backgrounds under Headlamp's base CSS, and removing those
  backgrounds left distracting green percentage text over the connections.
- Relationship-flow source nodes use an explicit blue gradient with white text,
  rather than Headlamp's theme `primary.dark`. In the default Headlamp theme
  that token resolves near black and brings the removed black-box problem back.
  No-usage quota nodes and edges also use blue instead of gray.
- `src/components/common/flowLayout.ts` centers relation-graph source nodes on
  the actual top/bottom bounds of the first target column. Quota, managed
  resource, Tenant-to-Namespace, and TenantOwner-to-Tenant flows all use it.
  Do not center a source from `rows * step`: target cards have a separate start
  offset and their height is smaller than the step, which visibly misaligns the
  two sides (especially for a graph with one target).
- On GlobalResourceQuota details, the plugin lists ResourceQuotas in the
  reported namespaces and matches generated objects using the
  `projectcapsule.dev/global-resource-quota` label, with owner reference as a
  fallback. Each linked namespace node opens the exact hashed namespaced
  ResourceQuota. Linked nodes must explicitly set `pointerEvents: all` because
  React Flow otherwise disables pointer interaction on non-selectable nodes.
- `quotaAggregation.ts` is the normalized data contract.
  `globalResourceQuotaAggregation()` adapts the keyed `status.total` and
  `status.namespaceUsage` maps. `customQuotaAggregation()` adapts the scalar
  CustomQuota APIs: a namespaced CustomQuota uses its own namespace and aggregate
  usage; a GlobalCustomQuota sums reported per-claim usage per namespace.
- Custom quota resource names are inferred from a common source path such as
  `.resources.requests.cpu` when possible (displayed as `requests.cpu`). Quotas
  with count/mixed/custom sources fall back to the CR name. If a
  GlobalCustomQuota reports namespaces but no per-claim usage, retain those
  namespaces in the flow with blue `No usage reported` state; do not invent a
  percentage from the global aggregate.
- CustomQuota and GlobalCustomQuota list summaries include `NAMESPACES IN
SCOPE`. The namespaced view counts unique CustomQuota namespaces; the global
  view counts controller-reported references from `status.namespaces` and
  `status.claims`.
- Native Namespace integration uses the public
  `registerDetailsViewSectionsProcessor` API in
  `NamespaceDetailsIntegration.tsx`. It inserts Capsule Quota Systems directly
  before Headlamp's `headlamp.namespace-owned-resourcequotas` section and adds a
  linked Tenant row to the existing top metadata table. The Namespace label
  `capsule.clastix.io/tenant` is authoritative; live Tenant status is the
  fallback. Before Headlamp's final Namespace details section it also inserts
  name-sorted, searchable owned-resource tables for namespaced CustomQuotas and
  TenantResources. Those tables use the Namespace and cluster directly, omit a
  redundant Namespace column, and link every object to its rich Capsule detail
  page. Do not restore the append-only `registerDetailsViewSection` path,
  because it places Capsule resources after the wrong native sections.
- `NamespaceQuotaSystems.tsx` combines referencing CustomQuota,
  GlobalCustomQuota, GlobalResourceQuota, and ResourcePool objects in one
  animated graph. Its single `Allocation type` selector reuses `?resource=` and
  filters the graph plus the effective-resource table.
- `namespaceEffectiveQuota.ts` unions Capsule systems with native Namespace
  ResourceQuotas and emits one row per resource. Kubernetes enforces all
  matching quotas, so the lowest hard value supplies Used/Hard/Available and is
  labeled the Limiting System. When hard limits tie, prefer the native
  ResourceQuota because its status is Kubernetes' concrete Namespace usage.
  Rows default to utilization descending and include the number of matching
  systems.
- `resourcePoolHelpers.ts` adapts `status.allocation` to the same exact
  used/hard/available contract. Per-namespace consumption is the unit-aware sum
  of bound `status.claims[namespace][].claims`; selected namespaces without a
  bound claim remain visible with `No usage reported`.
- ResourcePool Namespace Consumption nodes also show the claims associated with
  that Namespace. The aggregation unions controller-reported bound claims with
  live ResourcePoolClaims so queued and exhausted claims remain visible. Claim
  chips link to the rich canonical ResourcePoolClaim page; bound claims are
  filled blue, pending claims are outlined blue, and exhausted claims are red.
  A selected allocation type hides claims that do not request that resource.
- ResourcePool details also load live ResourcePoolClaims. The Claims section
  unions those with bound pool status so exhausted/queued claims are not hidden,
  groups them by Namespace, links each claim to its rich canonical CR page, and
  shows requested resources, Ready/Bound/Exhausted, the actionable controller
  message, and a release quick action. Both Bound values are blue information;
  `Exhausted=True` remains red and `False` is blue.
- ResourcePoolClaim canonical instance URLs have a dedicated detail page with
  Conditions/Events first, an animated Claim-to-ResourcePool relationship, and
  requested-allocation inventory. The pool node links to its rich detail page.
- `resourcePoolClaimRelease.ts` owns the safe release contract. Only a live
  claim whose Bound condition is explicitly False is enabled. The action patches
  `projectcapsule.dev/release: "true"`, reloads the local object, and lets the
  watch reconcile the table. Never enable it for a bound claim: upstream
  requires consumers to free claimed resources first. Contract source:
  <https://projectcapsule.dev/docs/resource-management/resourcepools/>.

## Capsule Proxy

- Capsule Proxy is optional. The plugin deliberately focuses on the preferred
  cluster-scoped `GlobalProxySettings`; it does not add a rich page for the
  older namespaced ProxySetting API. Official contract source:
  <https://projectcapsule.dev/docs/proxy/proxysettings/#globalproxysettings>.
- `components/proxy/GlobalProxySettingsList.tsx` shows readiness/message plus
  rule, unique-subject, and cluster-resource counts. Its three-card grid
  summarizes Ready state, subject kinds, and label-filtered cluster resource
  grants. Tables default to Name ascending.
- `GlobalProxySettingsDetail.tsx` keeps Conditions and Events together, exposes
  Ready and observed generation in metadata, and flattens every configured
  cluster-resource entry into a readable Proxy Rules table with subjects, API
  groups, resources, operations, and selectors.
- `globalProxySettingsHelpers.ts` owns all normalization and summary logic,
  including deterministic selector formatting and unique `Kind/name` subject
  counting. Keep these functions tested against both direct KubeObject-style
  fields and raw `jsonData` objects.
- Both list and detail pages render a friendly installation/access message when
  the CRD request fails. Do not let an absent optional Capsule Proxy installation
  crash or hide the rest of the Capsule overview.

## Capsule Settings

- Capsule navigation contains **Settings → Capsule Configuration**, backed by
  the cluster-scoped `capsuleconfigurations.capsule.clastix.io/v1beta2` API.
  Both the canonical Custom Resources URLs and the legacy `/capsule/settings/`
  aliases reuse `CapsuleConfigurationList.tsx` and
  `CapsuleConfigurationDetail.tsx`.
- The list health grid shows Ready/Reconciling/Not Ready/Unknown state, managed
  Tenants, reconciled identity kinds, and mutating/validating admission webhook
  counts. A Ready condition is only considered healthy when its observed
  generation has caught up with metadata generation.
- The detail page performs a named GET instead of deriving its contents from a
  permitted list response. This preserves Capsule Proxy's distinction between
  `List` and `Get` and prevents a list-only identity from seeing the rich
  configuration panels. Conditions and Events remain first.
- Detail subsections cover feature gates, admission webhooks, configured and
  reconciled identities, RBAC/controller overrides, and status-reported
  Tenants. CA bundles are deliberately omitted. Reported Tenant chips link to
  their canonical rich Tenant pages.
- `capsuleConfigurationHelpers.ts` normalizes both KubeObject and raw-object
  inputs and owns health, generation, identity, Tenant, webhook, and aggregate
  summary logic. Keep its Ready/Reconciling boundary covered by tests.

## Canonical Capsule custom-resource routes

- `src/resources/capsuleCustomResources.ts` owns the supported Capsule CRD names
  and Headlamp-compatible route helpers. Headlamp's canonical object URL is
  `/customresources/:crd/:namespace/:crName`; cluster-scoped objects use `-` for
  the namespace segment.
- `src/components/common/CapsuleCustomResourceDetail.tsx` is only an adapter. It
  reuses the existing rich list/detail components for Tenant, TenantOwner, CustomQuota,
  GlobalCustomQuota, GlobalResourceQuota, GlobalProxySettings,
  CapsuleConfiguration, ResourcePool, TenantResource, and GlobalTenantResource.
  Do not create a second implementation for CRD routes.
- Literal list and instance routes for those ten CRDs are registered before
  Headlamp's generic `:crd` routes. Thus the Custom Resources navigation,
  Capsule overview tiles, sidebar leaves, and direct CR instance URLs all use
  the same plugin UI. The older `/capsule/...` list/detail routes remain aliases
  for existing bookmarks.
- `CapsuleResourceLink.tsx` emits a canonical full-page CR instance link. Do not
  use Headlamp's ordinary `routeName="customresource"` link inside these plugin
  lists: when detail-drawer mode is enabled, Headlamp intercepts that link and
  opens its generic CR drawer instead of the rich page.
- Unsupported CRDs—including Capsule APIs without a dedicated plugin page—must
  continue to fall through to Headlamp's generic list/detail renderer.
- ResourcePoolClaim adds only a literal rich instance route; its generic list
  remains unchanged.
- `CapsuleDocumentationAction.tsx` provides the shared header documentation
  action for Tenant, TenantOwner, GlobalResourceQuota, ResourcePool,
  ResourcePoolClaim, CustomQuota, GlobalCustomQuota, GlobalProxySettings,
  GlobalTenantResource, and TenantResource. The `capsule.documentation-action`
  header processor inserts it immediately after Headlamp's `EDIT` action and
  before `DELETE`; do not register it as a plain global header action, which
  would place it before the defaults.
- `capsuleDocumentation.ts` owns the kind-to-path mapping and safe URL joining.
  Only absolute HTTP(S) base URLs are accepted; blank, invalid, or unsafe values
  fall back to `https://projectcapsule.dev`. Relative resource paths retain their
  anchors when joined to a configured mirror base.
- `capsulePluginConfig.ts` owns the shared typed `ConfigStore`. Headlamp
  **Settings → Plugins → capsule** exposes `documentationBaseUrl` and the
  `sectionAnchorsEnabled` switch through `CapsuleSettings.tsx`. Saved values are
  reactive, so documentation actions and section links update without a plugin
  rebuild.

## Tenant pages and navigation

- The Tenant list intentionally omits the Owners column, and the overview no
  longer has a Tenant table. Owners remain visible in Tenant details.
- `src/components/tenants/TenantNamespaceFlow.tsx` renders all
  controller-reported `status.owners` to the left of the Tenant, then one target
  node per managed Namespace to its right, with animated directional edges.
  Owner identity and cluster roles are status-authoritative; do not silently
  fall back to `spec.owners` because the diagram represents reconciled state.
  Namespace status uses the Tenant's `status.spaces` conditions with Namespace
  phase as fallback.
- Tenant detail has one `Namespaces` section. Its relationship flow is full
  width and its searchable namespace inventory is beneath the flow. Do not
  restore the standalone `Tenant namespace relationship` heading or the former
  side-by-side layout.
- The Tenant annotation icon is part of the main `Tenant: <name>` detail title.
  `components/common/TenantVisualIcon.tsx` renders a valid annotation icon and
  falls back to the simplified official CNCF Capsule color mark when the
  annotation is absent, invalid, or its image fails to load. Use it in the
  Tenant selector, list, detail title, and selected-Tenant tabs. Keep **No
  Tenant Filter** and multi-Tenant
  aggregate indicators distinct because they represent scope rather than one
  Tenant. The parent **Tenants** sidebar entry uses the same built-in account
  group icon as the **Tenants** leaf. Nested **Tenant** / **Tenants** menu
  entries intentionally retain their resource-oriented account icons; the
  Capsule mark is the fallback for each Tenant object, not a menu-category
  icon. Artwork source:
  <https://github.com/cncf/artwork/tree/main/projects/capsule/icon/color>.
  Annotation links render in a dedicated `Links` section only when at least one
  parsed link exists. Unsafe link schemes are rejected as navigation targets by
  `safeUrl`. Each JSON link entry can carry its own `icon`, independently of the
  Tenant icon. `normalizeIconRef` accepts native Iconify names, safe image URLs,
  Font Awesome 6 CSS classes (`fa-solid`, `fa-regular`, `fa-brands`), legacy
  Font Awesome aliases (`fas`, `far`, `fab`), and a bare `fa-<icon>` defaulting
  to FA6 solid. This applies to both Tenant and per-link icons across the Tenant
  selector/list/detail and selected-Tenant context bar. `favicon: true` or
  `icon: "favicon"` derives `<link-origin>/favicon.ico`; a string-valued
  `favicon` supplies an explicit URL. `getTenantLinkIcon` owns precedence and
  safety, while `normalizeTenantLinks` owns the per-entry data contract and
  drops malformed entries. Following Conditions and Events, the detail-section
  order is Quota Usage, Namespaces, Persistent Volumes, then Promoted
  ServiceAccounts; keep that order when adding Tenant sections.
- `TenantLinksBar.tsx` is registered as the `capsule-tenant-contexts` top-side
  UI panel, not as an app-bar action. It renders a responsive secondary row
  below the app bar: one tab per specifically selected Tenant, in selector
  order, with annotation icons. The active Tenant's annotation links occupy a
  separate action zone aligned directly after the Tenant tabs on desktop and a
  bordered, left-aligned lower row beneath the tabs on narrow screens. Its link
  buttons show the same resolved per-link icon/favicon as Tenant details. Tenant
  and link icons sit in 36–38px `palette.sidebar.selectedBackground` frames
  with contrast-aware foregrounds and render at 26–30px so image and Iconify
  annotations remain legible in dark and light themes. The complete context row
  and tabs have a 62px minimum height; link buttons have a 48px minimum height.
  Tenants without valid link targets do not render an empty link zone or `No
links configured` filler. An empty selection means **No Tenant Filter** and
  must render no context row.
- `TenantBox.tsx` labels an empty selection **No Tenant Filter**, because its
  cleared Namespace filter can include non-Tenant namespaces; do not call this
  state All Tenants. Its trigger and selection accents use
  `palette.sidebar.selectedBackground`, which is Headlamp yellow in the built-in
  light/dark themes. Per-Tenant avatars have no yellow outline. Status chips use
  explicit saturated green/yellow/red/blue backgrounds because Headlamp's
  semantic Chip palette aliases are intentionally very pale.
- Headlamp 0.44 renders `side: 'top'` UI panels immediately before the AppBar.
  The panel's root therefore assigns the adjacent `.MuiAppBar-root` flex order
  `-1`, which puts the AppBar first and the Tenant context directly below it.
  Keep the browser geometry assertion when changing this layout; registering a
  top panel alone places it on the wrong side of the bar.
- `tenantContext.ts` owns legacy/current local-storage selection parsing and
  maps selected names to Tenant metadata. Keep this shared logic independently
  testable; do not restore the old hover `Popper` navigation.
- Tenant details show a `Namespace quota` metadata chip only when
  `spec.namespaceOptions.quota` is configured. The chip compares the configured
  limit with status-reported Namespace usage; it is deliberately absent for an
  unlimited Tenant.
- PersistentVolume ownership is authoritative on PV metadata label
  `capsule.clastix.io/tenant=<tenant-name>`—not on the PVC's
  `projectcapsule.dev/tenant` label. Tenant details select matching PVs directly,
  then resolve their display PVCs through the PV `spec.claimRef` (with PVC
  `spec.volumeName` as fallback), render a full-width animated Tenant → PVC → PV
  flow, and keep the searchable/sortable PV table beneath it. A labeled PV stays
  visible directly beneath the Tenant if its PVC cannot be loaded.
  The Tenant source node uses the shared blue gradient
  `linear-gradient(135deg, #1976d2, #0d47a1)` with white text, matching Tenant
  nodes in the other relationship flows.
  `persistentVolumeTenant.ts` owns exact label matching, binding resolution,
  and deterministic ordering; never infer ownership from a claim Namespace.
  Native PersistentVolume details use the same PV label and load claimRef only
  to enrich the graph with its intermediate PVC.
- `Tenant.status.promotions` is authoritative for the `Promoted ServiceAccounts`
  section. `tenantStatusHelpers.ts` parses the Kubernetes identity
  `system:serviceaccount:<namespace>:<name>` and presents links, cluster roles,
  and targets. Do not infer successful promotions from ServiceAccount labels or
  merge `status.owners` into this table: the controller status is the requested
  source of truth.
- Native ServiceAccount details register `ServiceAccountPromotionAction.tsx`.
  It appears only for a ServiceAccount in a live Tenant Namespace and toggles
  the exact `owner.projectcapsule.dev/promote=true` label. Revocation removes
  that label. The action GET-reloads the ServiceAccount after patching so its
  local Headlamp object is current.
- Promotion has two independent gates: CapsuleConfiguration
  `spec.allowServiceAccountPromotion` must be true and Tenant
  `spec.permissions.allowOwnerPromotion` must not be false. The validating
  webhook additionally requires the signed-in Headlamp identity to be a Tenant
  owner; cluster-admin RBAC alone is intentionally insufficient. Disabled gates
  remain visible through the action tooltip instead of sending a predictably
  rejected request. Contract source:
  <https://projectcapsule.dev/docs/tenants/permissions/>.
- Tenant cordon/un-cordon uses the shared helpers in
  `src/components/common/tenantCordon.ts`. After patching, the action polls until
  the Tenant state, Cordoned condition, and all per-Namespace Cordoned conditions
  converge, then dispatches `capsule:tenant-refresh`. The detail graph and
  metadata therefore change without a manual page reload.
- The standalone `Cordoning` detail subsection was removed; the action remains
  in Headlamp's detail header and the current state remains in metadata and the
  graph.
- The main Capsule sidebar entry is labeled **Tenants** and groups nested
  `Tenant`, `Quotas`, `Replications`, `Proxy`, and `Settings` sections. Keep route sidebar IDs attached to their leaf entry
  so Headlamp expands the active subsection automatically.

## Resource Permits addon

ResourcePermit APIs and UI now belong to the standalone Resource Permits addon.
The plugin lives at `../resource-permits/headlamp/` and uses
`addons.projectcapsule.dev/v1beta2` with a top-level Permits menu. Requests,
template catalogs, lifecycle actions, notifications, and permit-specific
subject/tag correlation are owned there. Do not restore the retired core API
watches or duplicate those routes in this plugin. Keep generic Capsule subject,
tag, metadata, and managed-resource helpers here for core consumers.

## Subject references

- `CapsuleSubjectLink.tsx` is the reusable navigation surface for Capsule and
  Kubernetes subjects. Tenant owners, TenantOwner identities,
  impersonation ServiceAccounts, and Proxy subjects all link to
  `/capsule/subjects/:kind/:subject`. Preserve the current Namespace query when
  available; a source object may provide a more precise Namespace scope.
- A normal subject click uses Headlamp's public `Activity` API to open a
  temporary `split-right` subject-summary tab, matching native resource-detail
  links. Ctrl/Cmd/Shift/Alt clicks retain the cluster-aware full-page URL.
  Reconciled owner identities in the Tenant-to-Namespace flow and the identity
  in the TenantOwner relationship source use the same activity link; keep their
  React Flow nodes explicitly pointer-enabled.
- `subjectReferences.ts` owns exact identity normalization and matching.
  ServiceAccounts expressed as `namespace/name` or
  `system:serviceaccount:namespace:name` are the same identity, while equal
  ServiceAccount names in different Namespaces remain distinct.
- `CapsuleSubjectSummary.tsx` correlates every visible Tenant owner/promotion,
  native RoleBinding/ClusterRoleBinding subject, GlobalProxySettings
  rule subject, and TenantOwner whose `spec.kind/spec.name` is the exact
  normalized identity. Its relationship-section order is Tenants, Promotions,
  Tenant Owners, Global Proxy Settings, then Bindings. Promotions
  appear only for exact ServiceAccounts reported in `Tenant.status.promotions`.
  Relationship tables and their headings render only when they contain at
  least one hit; API access diagnostics remain independent of those empty
  sections. Tenant, namespaced RBAC, cluster RBAC,
  GlobalProxySettings, and TenantOwner requests remain independent: show an API-specific access
  diagnostic when one inventory is forbidden and retain any other readable
  inventories. Namespaced RBAC queries must reuse the explicit
  `?namespace=` array and must not fall back to a second unscoped list.

## Capsule resource tags

- Every supported Capsule resource accepts the comma-separated annotation
  `info.projectcapsule.dev/tags`. `components/tags/capsuleTags.ts` is the shared
  parser: trim values, discard empty entries, preserve declaration order, and
  de-duplicate exact strings. Tag matching is exact and case-sensitive.
- `CapsuleTagsTable.tsx` adds the same clickable Tags column through Headlamp's
  public resource-table processor to every dedicated Capsule CR inventory, the
  Namespace-owned CustomQuota/TenantResource inventories, and the generic
  ResourcePoolClaim table. Do not copy tag columns into individual list pages.
  `CapsuleTagsDetailsIntegration.tsx` similarly adds a Tags row to the standard
  metadata panel of every annotated `capsule.clastix.io` detail page.
- Clicking a tag opens `CapsuleTagSummary.tsx` as a temporary `split-right`
  activity, matching Subject navigation. The canonical
  `/capsule/tags/:tag` route remains available for modified clicks and direct
  URLs. Namespaced links union the source object's Namespace with the current
  `?namespace=` scope; cluster-scoped links preserve the current scope.
- The tag inventory independently queries all 11 supported Capsule kinds:
  CapsuleConfiguration, CustomQuota, GlobalCustomQuota, GlobalProxySettings,
  GlobalResourceQuota, GlobalTenantResource, ResourcePool, ResourcePoolClaim,
  Tenant, TenantOwner, and TenantResource. One forbidden or optional API must
  produce a concise partial-access diagnostic without hiding results from
  readable APIs. Rows link to canonical rich resource details.
- README metadata documentation covers shared tags, icons, and descriptions.
  ResourcePermit template metadata and catalog documentation live in the addon.

## TenantOwner pages

- TenantOwner is a first-class canonical Capsule CRD page. The overview card,
  Tenant > Tenant Owners sidebar leaf, list rows, canonical
  `/customresources/tenantowners.capsule.clastix.io/...` URLs, and legacy
  `/capsule/tenant-owners/...` aliases all reuse `TenantOwnerList.tsx` and
  `TenantOwnerDetail.tsx`.
- TenantOwner details use `ConditionsAndEvents` before the Tenant References
  section. `tenantOwnerReferences.ts` unions controller-reported
  `status.tenants` with live Tenant owner matches on `spec.kind/spec.name` and
  deduplicates them by Tenant name.
- `TenantOwnerFlow.tsx` draws the TenantOwner identity as the source and every
  referenced Tenant as a linked target with animated edges. Tenant nodes open
  the canonical rich Tenant detail page and explicitly enable pointer events on
  their non-selectable React Flow wrapper. When no visible Tenant references
  exist, show the honest empty state instead of an empty graph.
- The TenantOwner list shows identity kind/name, cluster roles, Tenant reference
  count, Ready status, and reconciliation message. Its summary cards cover
  readiness, identity kinds, and total Tenant references.
- Quotas sidebar order is Global Resource Quotas, Resource Pools, Global Custom
  Quotas, then Custom Quotas. The Quotas parent URL must remain the
  GlobalResourceQuota list so clicking the group opens that page by default.
- The Replications parent URL defaults to GlobalTenantResource. Keep Global
  Tenant Resources before Tenant Resources in that submenu.

## Resource map integration

- `src/components/map/CapsuleMap.tsx` replaces the default `/map` route with a
  supported plugin-owned resource map. Plugin routes are evaluated before
  default routes, so keep the same `/map`, `sidebar: 'map'`, and full-width route
  properties.
- Do not import anything under
  `@kinvolk/headlamp-plugin/lib/components/resourceMap`. The plugin build treats
  those private modules as browser-provided externals, but Headlamp does not
  publish their globals to third-party plugins. Such imports compile and bundle
  successfully, then fail in the browser with errors such as
  `Cannot read properties of undefined (reading 'useGetAllSources')`.
- React Flow is a direct plugin dependency and is bundled into `main.js`.
  `useMapSources.ts`, `mapGraph.ts`, and `mapTypes.ts` own the source hooks,
  relationships, compound-node layout, and local map types without relying on
  Headlamp's private implementation.
- The `Group By -> Tenant` option first creates Namespace groups, then nests
  those grids inside a Capsule Tenant boundary. Namespace label
  `capsule.clastix.io/tenant` is authoritative; Tenant status namespaces and
  spaces are the fallback. Unmanaged namespaces stay at map root.
- `src/components/map/tenantGrouping.ts` contains the pure grouping logic and
  has focused tests for ordinary grouping, reassignment/stale status, and
  cluster-scoped resource placement.
- `useMapSources.ts` supplies the disabled-by-default `Tenant` filter category.
  Its independently toggleable resource sources are
  Tenants, TenantOwners, ResourcePools, GlobalResourceQuotas, CustomQuotas,
  GlobalCustomQuotas, TenantResources, and GlobalTenantResources.

## Replication flow and SSA diff

- `src/components/common/ManagedResources.tsx` is shared by TenantResource and
  GlobalTenantResource details. It renders the aligned Managed Resources
  subsection, fetches the live inventory, and owns the selected SSA diff state.
- `ManagedResourceFlow.tsx` renders the TR/GTR as the source node and every
  applied object as a target node. Edges are animated, status is taken from the
  live object with Capsule status as fallback, and selecting a target opens its
  SSA diff inline. It uses the same bundled `@xyflow/react` dependency as the
  main map and must not import Headlamp's private map implementation.
- Both replication APIs model `spec.dependsOn`. List tables include `Depends On`
  with each dependency's live Ready state; details add a Dependencies table
  with the controller message. TenantResource references resolve only to a TR
  with the same Namespace, while GlobalTenantResource references resolve
  cluster-wide. Missing, unknown, not-ready, and ready states remain distinct
  and preserve declaration order.
- When dependencies exist, `ManagedResourceFlow.tsx` places their status nodes
  left of the TR/GTR source and draws animated dependency-to-source edges. The
  source shifts right responsively before its managed-resource targets; objects
  without dependencies keep the previous layout. Upstream contracts:
  <https://projectcapsule.dev/docs/replications/tenant/> and
  <https://projectcapsule.dev/docs/replications/global/>.
- `ssaDiff.ts` converts the live object and Kubernetes `fieldsV1` ownership tree
  to display lines. It understands `f:` fields and keyed/value list ownership,
  omits raw `metadata.managedFields`, and marks the ownership union of the
  selected per-generator Apply manager and
  `projectcapsule.dev/resource/controller`. Controller-owned Update fields are
  part of the active replicated change and must not be discarded.
- The SSA panel uses MUI theme colors, outlined surfaces, responsive overflow,
  and the same `SectionBox`/`DetailsGrid` gutter as other detail subsections. Do
  not restore the old hard-coded VS Code-style dialog.
- Managed-resource inventory tables show both Ready and Message. Message prefers
  a live non-ready Ready-condition message, then falls back to Capsule's matching
  `status.processedItems[].status.message`. TR/GTR Conditions use the shared
  `ConditionStatusChip`: ordinary True is green, False red, and Unknown amber.
  Cordoned is deliberately type-specific: False is gray and True is yellow.
- TenantResource and GlobalTenantResource list overviews use a balanced
  two-column `SummaryCardGrid` for their CR and replicated-resource graphs. Both
  list tables include Ready and Message columns sourced from the CR's Ready
  condition; messages fall back to the condition reason when needed. Do not
  expose impersonation in these overview tables. Each detail metadata panel
  instead links the configured `spec.serviceAccount` to the shared Subject
  activity: TenantResource derives the ServiceAccount Namespace from the
  namespaced CR, while GlobalTenantResource uses the reference's explicit
  Namespace.
- The Managed resource inventory is a standard Headlamp `ResourceListView`, not
  a `SimpleTable`. It provides global search, sortable/filterable columns,
  select filters for Namespace/Kind/Ready, and defaults to Name ascending. TR
  and GTR use separate stable table IDs. Keep row selection and mutation actions
  disabled because these are replicated targets, while retaining the explicit
  SSA Inspect action.

## Replication-resource cordoning

- `src/components/common/ReconcileActions.tsx` registers cordon/un-cordon header
  actions for both TenantResource and GlobalTenantResource. Their list pages
  expose the same actions in each row menu beside Force Reconcile.
- The shared tested request logic lives in
  `src/components/common/replicationCordon.ts`. TR uses the namespaced v1beta2
  endpoint and GTR the cluster-scoped endpoint. Cordon patches
  `spec.cordoned: true`; un-cordon sends `spec.cordoned: null`, matching the
  existing Tenant interaction and returning control to the CRD default.
- Actions optimistically update the button, revert on patch failure, and issue
  GET requests for the same resource after a successful patch until both
  `spec.cordoned` and the Cordoned condition converge. The refreshed API object
  replaces local `jsonData` and is announced to the TR/GTR detail view so its
  Conditions and managed-resource subsections leave the older list-cache object
  immediately. A reload failure is reported separately without pretending the
  already-successful patch failed.

## Working rules

- Preserve user changes and inspect `git status --short` before editing.
- Use `rg`/`rg --files` for repository searches.
- Use `apply_patch` for source and configuration edits.
- Prefer declarative Kubernetes resources and idempotent scripts/Make targets.
- Pin external images/charts to explicit versions; expose version overrides where
  they help local development.
- Do not commit generated `dist/`, plugin archives, credentials, kubeconfigs, or
  cluster-specific secrets.
- Keep RBAC scoped to what Headlamp needs. If broad cluster visibility is useful
  only for local development, label and document it explicitly as development
  access.

## Required validation

For plugin changes, run:

```sh
npm run lint
npm run format -- --check
npm run tsc
npm test
npm run build
```

For deployment changes, also render/validate the Kubernetes resources and, when
a cluster is available, deploy them and confirm that:

1. the Headlamp pod becomes Ready;
2. the `capsule` plugin files exist in Headlamp's plugin directory;
3. the service can be reached by port-forwarding; and
4. Capsule API resources can be listed through Headlamp's service account.

The deployment commands and file layout above are the maintained hand-off for
future agents. Update them whenever the environment changes.

## Last verified state (2026-08-19)

- The `capsule` kind cluster was recreated immediately before the latest plugin
  build. Its API is healthy and its Capsule, cert-manager, and metrics-server
  Flux HelmReleases are Ready, but it currently has no Headlamp HelmRelease,
  Deployment, or Pod. Therefore the latest bundle could not be injected or
  browser-verified; do not report the previous Headlamp workload as live.
- The locally derived Tenant admission-warning panel, helper, and tests were
  removed to avoid duplicating Capsule's webhook logic. Formatting, lint,
  TypeScript, all 174 tests across 37 files, and the production build pass with
  Node 24. The build transforms 273 modules and emits a 474.51 kB `main.js`
  (132.69 kB gzip) with SHA-256
  `289afc4da0c07c1439a09d739270e8f92e0d477277e386a3712ac91f4f4c45bf`.
- Before the 2026-08-19 recreation, `kind-capsule` was the playground cluster.
  Headlamp was
  installed by Flux HelmRelease `flux-system/headlamp` into `capsule-system`
  with release/deployment name `headlamp`, chart/app version `0.42.0`, and a
  shared `/build/plugins` EmptyDir mounted by `headlamp` and
  `headlamp-plugin`. The earlier standalone revision-39 notes below describe the
  previous incarnation of this kind cluster and are retained as history.
- The playground's configured Artifact Hub version `0.1.0-beta1` did not resolve
  through `pluginctl`, leaving the shared plugin directory empty. Running
  `make headlamp-playground-reload` successfully suspended only
  `flux-system/headlamp`, built the local bundle, injected it into the existing
  pod, and restarted only the Headlamp container. The pod remained `2/2 Ready`
  and the repeat lifecycle check increased only that container's restart count.
- The live `/plugins` endpoint now lists Capsule as a `development` plugin at
  `plugins/capsule`. Local, pod, and served `main.js` all have SHA-256
  `289afc4da0c07c1439a09d739270e8f92e0d477277e386a3712ac91f4f4c45bf`.
- The deployed Capsule Settings page reports live
  `CapsuleConfiguration/default` Ready and synchronized at generation `12 / 12`,
  with 4 managed Tenants, 17 reconciled identities, 11 mutating webhooks, and
  21 validating webhooks. Authenticated Chromium verified the nested sidebar,
  canonical list/detail URLs, functional `Edit` menu action, all detail
  subsections, and links for each reported Tenant.
- Tenant quick-link annotations now have an explicit normalized per-entry icon
  contract. `icon` accepts Font Awesome 6 classes such as
  `fa-solid fa-chart-line`, legacy `fas`/`far`/`fab` classes, native Iconify
  names, or safe image URLs. Font Awesome classes normalize to the matching
  Iconify collection, and the same normalization now fixes Tenant icons in the
  selector and list as well as per-link icons. Detail link icons are 28–30px in
  44px chips; context-row Tenant/link icons render at 30/26px in 38/36px
  Headlamp navigation-yellow frames with contrast-aware foregrounds; and the
  context link group is aligned directly after the Tenant tabs rather than pushed
  right. The row/tabs are at least 62px high and link buttons are at least 48px
  high. Favicon references
  remain supported as a secondary image source. Tests cover Font Awesome forms,
  mixed icon sources, favicon derivation/precedence/safety, whitespace
  normalization, and malformed entries; the README and create form contain
  copyable examples.
- Tenant selectors use Headlamp's visible navigation accent at
  `theme.palette.sidebar.selectedBackground`, not `primary.main`: the built-in
  dark theme sets primary to white but its selected-navigation accent to
  yellow. The trigger stays filled in No-Tenant-Filter and scoped modes; selected
  rows, checkboxes, dialog/menu accents, and hover states derive from the same
  accent. Selector state chips override Headlamp's very pale Chip variants and
  palette aliases with explicit saturated MUI color scales: green 700 for
  Active, navigation-accent yellow for Cordoned, red 700 for failed/not-ready,
  and blue 700 for other states. An authenticated Chromium check against the
  deployed bundle measured the trigger at `rgb(242, 230, 0)` and Active chips at
  `rgb(56, 142, 60)`. It also confirmed that the live `wind` Tenant's broken
  image annotation falls back to the Capsule SVG instead of MUI's Person icon.
  The parent Capsule sidebar entry uses the Capsule mark through an
  Iconify-compatible object instead of the previous generic account-group icon.
- Authenticated Chromium verified `No Tenant Filter` in the cleared selector.
  On native `solar-test` Namespace details it verified section order through
  Resource Quotas, LimitRange, Pods, Custom Quotas, Tenant Resources, and
  Events. Both new owned-resource inventories correctly render an empty table in
  the current playground because it has no namespaced CustomQuota or
  TenantResource objects.
- Tenant details now add a full-width Tenant → PVC → PV XYFlow and a searchable
  PV inventory sorted by name. Ownership uses the PV label
  `capsule.clastix.io/tenant`; claimRef supplies the intermediate PVC. Live
  inspection found exactly three `solar` PVs with that label and their three
  PVCs carrying the separate `projectcapsule.dev/tenant=solar` label. Resolver
  and graph tests cover exact PV-label filtering, bound-PVC enrichment,
  unavailable-claim fallback, wrong-label-domain, and native-detail paths. An
  authenticated Chromium run confirmed `3 PVC · 3 PV`, three PVC nodes, three
  PV nodes, six animated edges, and every PV name in both graph and table, with
  no relevant browser errors. It also measured the Tenant source as the shared
  blue `rgb(25, 118, 210)` to `rgb(13, 71, 161)` gradient.
  The same run measured the context bar at 63px and both Tenant/link icon-frame
  backgrounds at Headlamp yellow `rgb(242, 230, 0)`, with no relevant browser
  errors.
- All editable Capsule resource tables now retain Headlamp's standard
  row-actions dropdown rather than adding a visible Edit column. Authenticated
  Chromium found no table pencil column, four Tenant row-action menus, and
  `Edit`, `Download`, and `View YAML` in the opened menu. On the Tenant detail it
  confirmed six nested Namespace/PV authorization prewarms, Edit in the menu on
  first open after prewarm, and no relevant runtime errors. Headlamp 0.44 turns
  a denied Edit action into a second, icon-only ViewButton because it drops the
  menu button style on that fallback. `CapsuleTableEditAuthorization.css`
  suppresses only that malformed direct-child icon while retaining the normal
  `View YAML` MenuItem. A read-only Capsule service-account browser check
  measured the fallback as `display: none` and left `Download` plus `View YAML`
  visible; an authorized check still opened the functional YAML editor for a
  Tenant, ResourcePool, and GlobalTenantResource.
- The HelmRelease currently reports `Ready=True` and `Released=True`; the
  Headlamp pod is `2/2 Ready`. There are no Flux
  Kustomization objects in this playground, so no parent reconciliation is
  resetting the explicit HelmRelease suspension.
- The HelmRelease is deliberately left suspended for the active development
  session. Run `make headlamp-playground-resume` when finished; the injected
  bundle is ephemeral and disappears on the next pod rollout.

- Helm release `capsule-headlamp` revision 39 is deployed in `capsule-system` on
  context `kind-capsule` with chart/app version `0.44.0`.
- The official Headlamp GitHub release and Helm repository both report `0.44.0`
  as the latest version. The development chart is already current; do not bump
  it unless a newer chart is confirmed upstream. The current plugin SDK is
  `@kinvolk/headlamp-plugin@0.14.0`.
- Deployment `capsule-headlamp` is Available. Pod
  `capsule-headlamp-f6b547db6-9c629` has both Headlamp and `plugin-sync` Ready.
- The final deployment rebuilt the plugin image, upgraded the release at
  `2026-08-17T10:53:56+02:00`, and rolled Headlamp onto the durable bundle. The
  localhost port-forward was restarted against the new pod.
- A temporary service-account token listed tenants `green`, `solar`, and `wind`
  through Headlamp's `/clusters/main/apis/capsule.clastix.io/v1beta2/tenants`
  proxy route.
- The rendered release contains `capsule-headlamp-cluster-admin`, bound to the
  `capsule-system/capsule-headlamp` service account. Read-only authorization
  checks return `yes` for wildcard API resources, CRDs, Secrets, and deleting
  cluster-scoped Nodes. The previous Capsule-only editor role/binding was
  removed by Helm.
- Formatting, lint, TypeScript, all 174 tests across 37 files, and the production
  build pass with Node 24. The build transforms 273 modules and emits a
  474.51 kB `main.js` (132.69 kB gzip).
- Native Namespace details now show their linked Tenant in the metadata table,
  Capsule Quota Systems before ResourceQuotas, and an effective one-row-per-
  resource table using the tightest matching hard limit. Live `solar-test`
  verification found Tenant `solar`, five native ResourceQuotas, two matching
  GlobalResourceQuotas, and two matching ResourcePools. This supplies overlapping
  `pods`, `requests.cpu`, and `requests.memory` limits for the limiting-system
  selection path. Processor-level tests verify metadata preservation, Tenant-row
  injection, and exact section order. After the revision 28 rollout, the user
  confirmed that these Namespace changes are visible in the active Headlamp UI.
- Tenant details now conditionally show Namespace quota usage and a
  status-authoritative Promoted ServiceAccounts table. Native ServiceAccount
  details expose the owner promotion/revocation action with global and
  per-Tenant feature-gate awareness. A reversible check temporarily enabled the
  global gate and created `solar-test/headlamp-promotion-check`: Kubernetes admin
  was correctly rejected as a non-owner, while declared owner `alice` was
  allowed to apply and remove the promotion label. The local controller did not
  publish the promotion into Tenant status within the 20-second observation
  window, so no false label-derived table entry was introduced. The disposable
  ServiceAccount was deleted and the original global value `false` was restored.
- Tenant details now also aggregate every quota system labeled exactly
  `projectcapsule.dev/tenant=<tenant-name>` into a full-width animated flow and
  per-resource usage table. Live Chromium verification on `solar` found
  `solar-max-pods` and `solar-shared-compute`, two animated edges, and
  utilization-descending resource rows. Selecting `requests.cpu` produced
  `?resource=requests.cpu` and reduced the table to the single CPU row. Measured
  geometry confirmed both the quota usage table and Namespace inventory render
  below their respective XYFlows; the Namespace graph was 474px high and its
  table began below its bottom edge.
- Tenant identity is now anchored in the main title: the annotation icon is
  rendered beside `Tenant: solar`, while the Links heading is absent for a
  Tenant with no annotation links. The post-event order is Quota Overview,
  Namespaces, then Promoted ServiceAccounts. Authenticated Chromium verified
  all four headings in that order and found no browser errors.
- The Tenant Namespace flow now renders every reconciled `status.owners` entry
  to the left of the Tenant. Live `solar` verification showed both
  `Group/oidc:org:platform` and `User/alice`, including their cluster roles,
  followed by the Tenant and four Namespaces with six animated edges.
- TR/GTR list and detail views now resolve `spec.dependsOn`, show dependency
  state/message tables, and place dependency nodes to the left of the replication
  resource in the animated managed-resource flow. Focused tests cover same-
  Namespace TR resolution, cluster-wide GTR resolution, missing/not-ready/unknown
  states, declaration order, graph placement, and animated edge direction.
- Headlamp's authenticated proxy returned HTTP 200 for ResourcePools (2),
  TenantOwners (12), CustomQuotas (0), GlobalCustomQuotas (3), TenantResources
  (0), GlobalTenantResources (3), and GlobalProxySettings (3).
- Capsule Proxy v0.13.9 supplies the live GlobalProxySettings CRD and three
  generated objects: `green-proxy-settings`, `solar-proxy-settings`, and
  `wind-proxy-settings`. All three reported `Ready=True`, `Succeeded`, and
  `reconciled`. Authenticated Chromium verified the overview tile (`3 Ready`,
  `3 Rules · 6 Subjects`), dedicated Proxy sidebar, Name-ascending canonical
  list, readiness/message columns, and solar's rich detail. The detail showed
  Conditions beside Events, both status subjects, the
  `capsule.clastix.io/globalresourcequotas` List grant, and the exact
  `projectcapsule.dev/tenant=solar` selector. The Proxy docs action was present,
  and there were no plugin runtime errors.
- GlobalResourceQuota now has a dedicated sidebar entry, list page, detail page,
  and overview-card route. It was verified against the installed v1beta2 CRD
  and the live `green-shared-compute` object. A reversible authenticated browser
  check supplied two temporary namespace usage entries and confirmed exact list
  values (`4 / 8`, `12Gi / 16Gi`), two animated namespace edges, and exact
  `green-prod` node values (`3 / 8`, `8Gi / 16Gi`). The original zero-usage
  status was restored afterward. No React, TypeError, private-map, or RBAC
  browser errors occurred.
- GlobalResourceQuota, GlobalCustomQuota, CustomQuota, and ResourcePool details
  now share the aggregation table, single-resource selector, and animated Namespace
  Consumption view. An authenticated Chromium run verified that GRQ defaults to
  all four resources, selecting `requests.cpu` removes the other aggregate and
  namespace metrics, and all three namespace cards display CPU-specific
  percentages. It also verified `limits.cpu` on the live GlobalCustomQuota and a
  temporary namespaced CustomQuota at 30% utilization. The temporary object was
  deleted after validation, and no relevant browser errors occurred.
- GRQ aggregate and Namespace Consumption tables default to highest utilization
  first. A deployed Chromium check confirmed the live aggregate order and
  `solar-prod`, `solar-test`, `solar-dev` namespace order; all three graph cards
  linked to the exact generated `capsule-global-quota-*` ResourceQuota and a
  real click opened the solar-prod ResourceQuota detail. Quota connections no
  longer render percentage text or label backgrounds.
- TenantOwner now has dedicated canonical list/detail pages with Conditions,
  Events, and an animated reference graph. A temporary `User/alice` TenantOwner
  produced controller-reported `status.tenants: [solar]`; authenticated Chromium
  confirmed the canonical list link, Ready condition, Events section, animated
  owner-to-solar edge, and real navigation to solar's rich Tenant page. It also
  verified the Quotas parent and then-current submenu order. The later verified
  order is GRQ/ResourcePool/GCustomQuota/CustomQuota. The
  temporary TenantOwner was deleted after validation and no relevant browser
  errors occurred.
- Supported Capsule CRD list and instance URLs now reuse the plugin views:
  Tenant, TenantOwner, CustomQuota, GlobalCustomQuota, GlobalResourceQuota,
  ResourcePool, TenantResource, and GlobalTenantResource. An authenticated
  Chromium run opened the standard
  Tenant CRD URL, followed `solar` to the canonical instance URL, and confirmed
  the rich identity/namespace-flow view. The Capsule Tenant list generated the
  same URL; canonical GTR and GRQ URLs rendered their graphs and header actions;
  overview cards and sidebar leaves referenced canonical CRD lists. TenantOwner
  verified that unsupported CRDs still fall through to Headlamp. No relevant
  browser errors occurred.
- All custom detail subsections and list-page summary rows use Headlamp's
  matching responsive gutters.
- The Map now offers Tenant grouping and a Tenant filter category. Live Tenant
  status and Namespace labels were verified for tenants `green`, `solar`, and
  `wind`; managed Namespace labels use `capsule.clastix.io/tenant` as expected.
  The production bundle contains no `components/resourceMap`,
  `componentsresourceMap`, or `useGetAllSources` reference, closing the browser
  runtime regression caused by private Headlamp externals.
- TenantResource and GlobalTenantResource detail pages now show an animated
  React Flow replication diagram. Clicking a managed object opens the aligned,
  theme-aware inline SSA diff; focused tests cover graph edges/selection and
  nested/keyed-list `fieldsV1` ownership. The live `cluster-replication` GTR has
  12 ConfigMaps and a representative target exposes both the hashed Capsule
  `Apply` manager and the controller's separate `Update` manager; the SSA view
  combines both field sets.
- Managed-resource tables now expose reconciliation messages; SSA highlighting
  combines the generator and controller field sets. TR/GTR condition chips are
  color-coded. All overview tiles link to their relevant subpage, and Managed
  Resources opens `/map?group=tenant&show=all`. Live GTR processed items have
  previously supplied actionable webhook connection errors, confirming the
  Message fallback against representative non-ready data.
- TR/GTR list overview graphs now align as a two-column responsive grid. Their
  resource tables show Ready and Message, and Cordoned condition chips use gray
  for False and yellow for True. All three GTRs reported `Ready=True` during the
  final 2026-08-14 verification; earlier failure states provided representative
  data for the message and color paths.
- TR/GTR details and row menus now expose Cordon/Uncordon. A reversible check
  through Headlamp's authenticated proxy changed `cluster-replication` from
  false to true, reloaded true, removed the cordon, and reloaded false. The
  development service account also has both get and patch permission for
  namespaced TenantResources; there were no live TR instances to mutate.
- A clean authenticated Chromium run loaded the deployed GTR detail with no
  plugin runtime error and confirmed the header action, standard inventory
  search/filter controls, and the current bundle checksum. Clicking the actual
  action visibly changed the Conditions row from
  `Cordoned False / Active / not cordoned` to
  `Cordoned True / Cordoned / is cordoned`, then back to False after Uncordon.
  This test found and closed the earlier issue where only the action component's
  local object reloaded while the Conditions subsection retained a stale
  `useList` object.
- Both TR/GTR Managed resource inventories now use Headlamp's searchable,
  sortable, filterable resource table with Name ascending by default.
- Tenant list charts have the additional inset top spacing, the shared Tenant
  table has no Owners column, and zero-value graph slices/chips are omitted. A
  live authenticated Chromium run verified the nested sidebar sections,
  Tenant icon/Runbook chips, four Namespace nodes with four animated edges, and
  absence of the old Cordoning heading and `0 Not Ready` chip.
- The same reversible Chromium run cordoned and uncordoned Tenant `green`. It
  waited for the `capsule:tenant-refresh` event and verified the Tenant node plus
  all four Namespace nodes changed to Cordoned and back to Active/Ready. Test
  annotations and `spec.cordoned` were restored afterward.
- Capsule details now group Conditions and newest-first Events directly. An
  authenticated Chromium run verified the Tenant and GTR layouts. The overview
  has no Tenant table/footer link and its Capsule Events inventory displayed a
  live `Tenant/green` Event. The Tenant detail showed the flow and four-row
  searchable inventory under the same `Namespaces` heading in two aligned
  columns. No React, TypeError, private-map, or RBAC browser errors occurred.
- A deployed authenticated Chromium check measured zero vertical center offset
  for the live quota (3 targets), Tenant (4), replication (10), and TenantOwner
  (2) flows. The quota flow contained zero SVG edge-text elements and produced
  no relevant browser errors.
- Quota resource selection is shareable through `?resource=...` on all four
  shared aggregation views. Chromium opened GRQ directly at
  `?resource=requests.cpu`, changed it to `requests.memory`, preserved an
  unrelated query parameter, reloaded, and retained the selection.
- ResourcePool has canonical and legacy list/detail pages and is a leaf under
  Quotas. Live verification showed both pools, four selected Namespace nodes for
  `solar-pool`, a single-resource allocation view, and claims grouped as
  `solar-test (2)`. Both the bound `get-me-solar` and rejected
  `get-me-solar-2` were present; the latter showed its requested-versus-available
  exhaustion message. No relevant browser errors occurred.
- ResourcePool Namespace Consumption nodes now contain their claims directly.
  Authenticated Chromium verified that `solar-test` contains the bound
  `get-me-solar` and exhausted `get-me-solar-2`, with both chips linking to the
  exact namespaced rich ResourcePoolClaim pages and four animated pool edges.
- CustomQuota and GlobalCustomQuota list pages expose Namespaces in Scope. The
  native `solar-test` Namespace showed one relationship graph with two
  GlobalResourceQuotas and two ResourcePools. Selecting `requests.cpu` through
  `?resource=requests.cpu` reduced it to the three CPU-capable systems and
  survived a reload.
- ResourcePoolClaim `solar-test/get-me-solar-2` rendered its rich canonical page
  with one animated edge to `solar-pool`, exact requested values, and blue
  `Bound=False` chips. In the pool Claims table its release action was enabled,
  while bound `get-me-solar` was blue and disabled. Browser verification did not
  click either action, so cluster claim state was not mutated.
- Authenticated Chromium verified quota submenu order as GlobalResourceQuota,
  ResourcePool, GlobalCustomQuota, CustomQuota; the Replications parent opens
  GlobalTenantResource. It also measured equal Tenant/Managed Namespaces card
  widths in one aligned row. Explicit blue flow sources removed the remaining
  black theme-derived source box. No relevant browser errors occurred.
- Every requested Capsule detail kind now has a contextual Docs header action.
  Authenticated Chromium verified the live Tenant header order as
  `Edit → Open Capsule documentation → Delete`, and clicking the action resolved
  to `https://projectcapsule.dev/docs/tenants/`. The Capsule plugin settings page
  showed the default base, then saving `https://docs.example.test/capsule`
  immediately changed the action target to
  `https://docs.example.test/capsule/docs/tenants/`. Focused tests cover all ten
  kind paths, anchors, unsafe-base fallback, deduplication, and action order.
- Annotation-driven Tenant links no longer occupy an app-bar action or hover
  `Popper`. Specific selections render a responsive second context row directly
  below the AppBar, with one icon-bearing tab per selected Tenant and only the
  active Tenant's links. Links are right-aligned on desktop and move into their
  own lower row on narrow screens. **No Tenant Filter** renders no row. Authenticated
  Chromium verified `green`/`solar` selection order, both annotation icons,
  active-link switching, the desktop right-edge placement, and the 600px layout
  (`tabs y=62..104`, `links y=104..146`). Both final runs had no React/plugin
  runtime errors, and temporary annotations were restored.
- The final `main.js` SHA-256 is
  `b5937e360a98035bcbb2d1f0cdad0567b1f1101dcc1ddff13124816b105dab36` locally,
  in the pod, and from the active Headlamp port-forward.
- Revision 39 rebuilt and loaded plugin image
  `sha256:9f494af6226008bcd10b3ff69335e641ffaccb944036cbbe9412eada8e81d522`.
  The deployment template records the same bundle checksum in the
  `capsule-headlamp-dev-revision` annotation.
- The conflict-free `127.0.0.1:8081` forward was restarted after revision 39.
  The `solar-proxy-settings` canonical detail route returns Headlamp HTML with
  HTTP 200 and the served plugin has the expected checksum;
  `::1:8080` belongs to the Capsule controller and correctly explains the
  misleading 404 seen through `localhost:8080`.
- During the revision 32 rollout, the long-lived kind control plane again became
  saturated: host API calls failed with TLS handshake timeouts, and
  kube-apiserver logged etcd handler timeouts. Restarting only the
  `capsule-control-plane` Docker container
  preserved cluster data. Revision 32 was left `pending-upgrade`, so it was
  cleanly rolled back as revision 33 before the successful revision 34 upgrade.
  `/readyz` returned `ok` afterward. Check `/readyz` before retrying sync/deploy
  if this recurs instead of diagnosing it as a plugin failure.
- Revision 35 hit the same saturation and was left pending while
  `kube-controller-manager` lost its leader lease. Four orphaned Playwright
  verification trees (two older than a day) were consuming CPU continuously;
  terminating only those stale tests and restarting only
  `capsule-control-plane` restored etcd, RBAC bootstrap, `/readyz`, and the
  controller-manager. Revision 35 was cleanly rolled back as revision 36 before
  revision 37 deployed. When saturation recurs, check for stale
  `/tmp/*verify*.cjs` or `/tmp/*check*.cjs` processes as well as control-plane
  health; browser smoke scripts must always close Chromium in `finally` and
  should be externally time-bounded.
- A same-ReplicaSet replacement previously demonstrated that
  `make headlamp-sync` is ephemeral. Always finish with `make headlamp-deploy`,
  select the newest Running pod, restart the port-forward, and compare local,
  pod, and served bundle checksums as described above.
- The ResourceLease audit table is now a stage-colored chronological timeline,
  with visibly filled/tinted stage bubbles, linked requestor/reviewer actors,
  controller stages linked through the status-reported execution ServiceAccount,
  and linked subjects extracted from rendered RBAC manifests. Subject links
  across Tenant, TenantOwner, ResourceLease, both ResourceLease template kinds, and
  GlobalProxySettings open the permission-aware Tenant/RBAC/ResourceLease
  correlation page.
- The Subject activity orders Tenants, Promotions, Tenant Owners, Resource Leases,
  Global Proxy Settings, then Bindings and omits every empty relationship heading/table.
  Promotions appear only for ServiceAccount subjects and are sourced exclusively
  from matching `Tenant.status.promotions`; the table exposes the reporting Tenant,
  Namespace, cluster roles, and targets.
  Review and Expire are dedicated detail-header and table buttons. Reviewable
  requests open the right-side resulting-changes/verdict activity; Expire uses
  a confirmed terminal status transition. The ResourceLease list also opens a
  prominent template-first, two-step JSON-schema-driven creation activity with
  generated naming and annotated catalog previews. The ordinary request detail hides
  rendered approval resources and shows a verdict overview only for completed
  reviews. Validation did not submit Review, Expire, or Create mutations.
- GlobalProxySettings subject correlation is constrained by the signed-in
  account's Capsule Proxy view. In the playground, Alice's policy is sourced
  from `solar-proxy-settings`, but a list of GlobalProxySettings returns HTTP
  200 with zero items because the policy does not grant List on that resource.
  The browser cannot safely recover the hidden policy name or contents; do not
  infer names from Tenant names or use a privileged identity. To expose those
  rows, the matching GlobalProxySettings policy must itself grant selector-
  scoped List access to `globalproxysettings` (and label the setting so that
  selector can isolate it), or Capsule Proxy must provide a dedicated
  self-policy introspection API.
- On 2026-08-31, formatting, lint, TypeScript, all 233 tests across 52 files,
  and the production build passed with Node 24. The build transforms 324
  modules and emits a 576.77 kB `main.js` (160.34 kB gzip).
- Authenticated Chromium verified the template overview and linked Namespace
  availability table, filled audit colors, completed-versus-pending verdict
  visibility, both default-collapsed ResourceLease data tables and their expand
  action, the linked status ServiceAccount actor, the admin-visible User/alice
  subject page's matching `solar-proxy-settings` section, and both Setup/Template Parameters
  wizard pages including generated naming. It also verified that Request
  Template, GlobalTenantResource, and TenantResource list overviews omit
  impersonation, while all three detail metadata panels expose it; both
  replication details show their expected linked ServiceAccounts and a template
  without an explicit override shows **Capsule default identity**. The Setup
  form explicitly describes an empty Duration as unlimited with no expiration
  timestamp. Intercepted read responses additionally
  verified comma-separated tag chips in a Capsule list and detail metadata, the
  right-side Tag activity, and one combined result table containing a tagged
  Tenant and GlobalResourceLeaseTemplate. The runs reported no React/plugin
  runtime errors and did not submit any mutation or alter cluster objects. The
  New ResourceLease browser run also verified removal of the exclusive template
  dropdown, multi-tag AND filtering, composed text search, primary-tag category
  grids, card selection, and continuation through Setup to Template Parameters.
  A second run used the live `x-capsule-form` template schema and real Kubernetes
  discovery/list responses to select a CustomResourceDefinition, then intercepted
  the final create request and confirmed the mapped raw name in `spec.params`;
  the POST did not reach Kubernetes. A review-mode run used the real pending
  `solar-test/customquotas-editor-alice` snapshot and verified that only
  **Resulting Changes** remains, all three entries start collapsed and expand,
  and effective Duration/Start time values are prefilled and editable. Its
  intercepted approval carried the adjusted duration and UTC-normalized start
  time without resources or reviewer identity; the PATCH did not reach
  Kubernetes. A later read-only run verified the exact Review and Expire CLI
  commands on their real surfaces, copied both values through the browser
  clipboard, cancelled Expire, and confirmed the ResourceLease managed-resource
  table follows its diagram without the redundant inventory heading. Because
  the former pending request had since become Active externally, that run
  intercepted only its named GET to present the existing snapshot as Requested;
  no lifecycle mutation was sent and all live phases remained unchanged.
- The Flux playground reload is ready with matching local/pod SHA-256
  `244279798c935e3556c76ce2ea3f1ede6d57dbe77d751f6db321396c83ff1865`,
  and Flux was resumed afterward. Authenticated Chromium verified the Requests
  and Templates menu labels, the dedicated namespaced template overview,
  namespaced/global catalog cards and scope labels, the compact global table,
  local-template Setup loading, explicit review verdict, and prominent audit
  Timestamp without React/plugin runtime errors. Read-only impersonation
  confirmed Alice can
  list ResourceLeases and RoleBindings in the four selected solar Namespaces,
  and can create/update ResourceLease status, while Tenant,
  ClusterRoleBinding, and GlobalResourceLeaseTemplate list/get remain denied.
  The subject and create activities therefore retain explicit independent
  diagnostics for those cluster-scoped prerequisites.
- On 2026-09-01, formatting, lint, TypeScript, all 236 tests across 53 files,
  and the production build passed with Node 24. The build transforms 325
  modules and emits a 577.49 kB `main.js` (160.60 kB gzip). Section fragment
  links now use the reactive **Shareable section links** plugin setting; unit
  coverage verifies the web default, Desktop-disabled default, and explicit
  override. The Flux playground reload has matching local/pod SHA-256
  `af75a45d95d13c0b85518e0a6efecfbe9e577b1fcf55444d8be1266690ac02d4`,
  and Flux was resumed afterward.
- The 2026-09-01 template-catalog regression check found zero live namespaced
  ResourceLeaseTemplates and three live GlobalResourceLeaseTemplates. The
  combined Templates inventory now retains those global entries, summarizes
  their resolved Namespace availability, and keeps partial API errors
  non-fatal. TypeScript, lint, all 237 tests across 53 files, and the production
  build passed. The deployed bundle SHA-256 is
  `29e241cc5083c54512fa86a581d720a9cd9ab97b2f32e1fcf308bb3ba23d026c`.
- On 2026-09-01, ResourceLease parameter creation moved from the flat custom
  parser to RJSF/MUI backed by Ajv's JSON Schema 2020-12 implementation.
  Recursive `x-capsule-form` discovery covers the complete supported schema
  keyword set and loop-safe local references; Kubernetes resource selectors
  support arbitrary discovered GVKs, all Namespace modes/selectors/templates,
  scalar strings, and array-item `string[]` values. Formatting, lint,
  TypeScript, all 251 tests across 56 files, and the production build passed
  with Node 24. The build transforms 758 modules and emits an 862.42 kB
  `main.js` (250.62 kB gzip). The live playground schemas included both a
  scalar ClusterRole selector and the new ClusterRole/Namespace array-item
  selectors. The served/local/pod bundle SHA-256 matched at
  `3d25a875ee72773d430e0cedec2b9c31df46cc403372f08738c1620f3bf2104d`,
  and Flux reconciliation was resumed afterward. Validation did not create or
  mutate any Kubernetes resource.
- The former condition-derived ResourceLease audit sorting used lifecycle
  precedence as a tie-breaker for equal timestamps. The current API supersedes
  that behavior with append-only `status.transitions`; the UI now preserves the
  controller's array order, so equal-time Approved then Active entries remain
  correctly ordered without reconstructing history from conditions.
  `resourceLeasePhasePresentation()` is the single color/icon source for the
  audit timeline, phase chips, subject results, and request-summary segments.
  On 2026-09-01, TypeScript, lint, and all 253 tests across 56 files passed. The
  playground build transforms 759 modules and emits an 862.77 kB `main.js`
  (250.75 kB gzip). Local, pod, and the bundle served over Headlamp HTTP all
  matched SHA-256
  `cd84ca97e6dd9a291d67682a9fb5ece26a473e3c9f0a9c1ea5074321fb572822`;
  Flux reconciliation was resumed afterward.
- Later on 2026-09-01, a same-ReplicaSet pod replacement discarded that
  pod-local injection and restored an older image bundle. The current bundle
  was injected into `headlamp-f959cb88f-nwj6j`; only the Headlamp server
  container was restarted, and `flux-system/headlamp` was deliberately left
  suspended. Browser verification exposed and fixed two RJSF startup failures
  caused by the stock SDK's MUI/lodash-es submodule globals. The repository now
  builds through `vite.config.mjs`, which maps those dependencies to Headlamp's
  actual shared exports. Formatting, lint, TypeScript, all 253 tests across 56
  files, and the production build passed with Node 24. The build transforms 766
  modules and emits an 871.15 kB `main.js` (253.19 kB gzip). Local, pod, and
  browser-served bundle checksums match at
  `92caed294621e4347b48a4ed314dbef3d46f3b5f6fea526d0261c1558d81111d`.
  Authenticated clean Chromium renders the Capsule sidebar and rich
  ResourceLease detail; its audit trail visibly orders equal-timestamp Approved
  before Active. No HelmRelease resume or pod rollout was performed.
- The New ResourceLease wizard now offers optional **View YAML** actions on both
  Setup and Template Parameters. `ResourceLeaseYamlDialog.tsx` serializes the
  same `buildCreateResourceLease()` body used for submission, including the
  JSON Schema form's applied defaults, and provides an in-app preview plus Copy
  and Download; generated-name prefixes produce stable filenames, and
  preview/export never calls the API. Formatting, lint,
  TypeScript, all 255 tests across 57 files, and the production build passed.
  Authenticated Chromium verified both live wizard steps, clipboard content,
  the downloaded `yaml-preview-check.yaml` name, omission of `spec.requestor`,
  and zero ResourceLease POSTs. Local, pod, and browser-served checksums match at
  `8809942a083220d0463417b96a5f1cd8da465bece4c2c6c5715abad0c48ad3a4`;
  the Flux HelmRelease remains suspended and only the Headlamp server container
  was restarted.
- Dedicated ResourceLease, combined ResourceLeaseTemplate, CustomQuota, and
  TenantResource overview tables no longer render Headlamp's Namespace picker.
  Their Namespace columns and global Tenant/Namespace query scope remain
  unchanged. Formatting, lint, TypeScript, all 255 tests across 57 files, and
  the production build passed. Authenticated Chromium found zero Namespace
  pickers on all four live tables while preserving each route's Namespace query
  and reported no plugin errors. The injected bundle SHA-256 is
  `b4ead601efcc667b08919d25f3e1cb342ad75b61f0db983e729a97fbf20fb106`;
  Flux remains suspended and only the Headlamp server container was restarted.
- ResourceLease approval no longer requires a review comment. A blank approval
  omits `status.review.message`; decline still requires a non-empty comment.
  Formatting, lint, TypeScript, all 256 tests across 57 files, and the
  production build passed.
  Authenticated Chromium verified the live empty approval form has no required
  comment, shows the conditional helper text, and enables **Submit approval**
  without sending a PATCH or reporting plugin errors. The injected bundle
  SHA-256 is
  `1fe37007f1960cd14aa4b0117ab7fa72e82284c58a7c15a83d505900aaf89df7`;
  Flux remains suspended and only the Headlamp server container was restarted.
- On 2026-09-02, ResourceLease consumers moved to the controller-resolved
  `status.request` contract. Lists, details, review, resulting changes, audit
  actors, and Subject correlation now read its template/version,
  impersonation, duration/start, retention, and rendered resources. Review
  lifecycle overrides are submitted under `status.request` without copying
  controller-owned fields; the former status layout remains a read-only legacy
  fallback. Formatting, lint, TypeScript, all 257 tests across 57 files, and the
  production build passed. Authenticated Chromium verified the real
  `solar-test/clustrrole-alice` status data, resolved detail fields, linked
  execution ServiceAccount, enabled review, and an intercepted approval body
  containing only `status.request.duration/startTime`, phase, and verdict. The
  real object remained Requested/Pending. The injected bundle SHA-256 is
  `3739847afde689f778203d042d8551bb8bf219670e4c6896d747bd6d30944bbe`;
  Flux remains suspended and only the Headlamp server container was restarted.
- The Resource Lease navigation parent is now labeled **Catalog**, retaining
  the Requests and Templates leaves. The overview places a Namespace-scoped
  ResourceLease lifecycle/review-workload Catalog card beside the existing Proxy
  card; its link preserves the selected Namespace query. Formatting, lint,
  TypeScript, all 258 tests across 57 files, and the production build passed.
  Authenticated Chromium verified the live Catalog menu, absence of the old
  label, one visible ResourceLease, side-by-side Catalog/Proxy geometry, and the
  scoped Requests link without plugin errors. The injected bundle SHA-256 is
  `05dc7024311d2a040125de0ae5db495a8c1e865891cfdc489812e57cf90a107d`;
  Flux remains suspended and only the Headlamp server container was restarted.
- ServiceAccount Subject activities now add a conditional **Promotions** table
  immediately after Tenants. It reuses the status-authoritative Tenant promotion
  parser and shows the reporting Tenant, ServiceAccount Namespace, cluster roles,
  and target Namespaces. Formatting, lint, TypeScript, all 259 tests across 57
  files, and the production build passed. Authenticated Chromium opened the
  activity from the live `solar` Tenant's
  `solar-system/gateway-api-role-distributor` promotion without navigating away,
  verified both reported cluster roles and all four targets, and found no plugin
  errors. The injected and served bundle SHA-256 is
  `8a91ef3679bcaa90f4791eee0f4696309a5ce14ba21390b6218e763437cea374`;
  Flux remains suspended and only the Headlamp server container was restarted.
- On 2026-09-02, the plugin was aligned with the current ResourceLease API from
  the controller repository and the installed CRD. `status.transitions` is now
  the sole audit-history source and every entry uses its attached actor, reason,
  message, and timestamps; conditions remain operational state only. The
  controller snapshot under `status.request` now also drives captured approval
  policy, rendered resources, template identity, impersonation, timing, and
  retention. Review submits only the requested phase plus optional comment and
  timing overrides, while Failed requests expose the controller failure state
  and a dedicated Retry lifecycle action. Formatting, lint, TypeScript, all 261
  tests across 58 files, and the production build passed. Authenticated Chromium
  verified transition-only audit rendering, captured approvals, failure/retry,
  and an intercepted minimal approval status PATCH without plugin errors. The
  local, injected, and browser-served bundle SHA-256 is
  `e53943fcfc5698771057cb830ac9f6c8923b229eaab7f523f0c2d82c777ff2bc`;
  Flux remains suspended and only the Headlamp server container was restarted.
- ResourceLeases now show planned lifecycle branches after authenticated history:
  `status.keepUntil` schedules Archiving, while an Approved request with a future
  `status.request.startTime` schedules Active and displays its activation time.
  The phase-colored branch retains 28px separation, is strictly vertical, and
  runs through an on-spine calendar milestone with the Future lifecycle label
  beside it. All 42px-grid nodes and 2px connectors share the exact center, and
  each connector stops at the destination node edge. Archiving chips use filled
  yellow with dark readable text; Active uses its matching green. Requested is
  neutral slate, Expired is deep orange, and real actor-backed transitions
  replace planned markers. Formatting, lint, TypeScript, all 266 tests across 59
  files, focused timeline tests, and the production build passed. Authenticated
  Chromium verified both planned phases, exact palette/contrast, centered and
  edge-stopped geometry, zero horizontal lines, the 28px future gap, and no
  plugin errors. The local, injected, and browser-served bundle SHA-256 is
  `4f27c9bfac675c49dd917979d5adf57275c419501a5710baf7dee034db2b2b68`;
  Flux remains suspended and only the Headlamp server container was restarted.
- The top app bar now includes a ResourceLease-only EventHub. It resolves the
  logged-in Kubernetes identity, shows only Active/Approved/Denied/Expired to
  exact requestors, and only Requested to explicitly matched manual reviewers.
  Only the final append-only transition for each ResourceLease is eligible, so a
  request never leaves stale notifications for its earlier stages. Actor
  identities link to the right-side Subject activity.
  Its relative-timeframe selector offers 1 hour, 24 hours, 7 days, 30 days, and
  all time, defaulting to 24 hours. Actionable reviewer entries retain a direct
  Review action. It does not consume generic Kubernetes Events or actor annotations. Namespace
  scoping follows the global filter or Catalog query and list errors remain
  visible. Formatting, lint, TypeScript, all 272 tests across 60 files, focused
  identity/feed tests, and the production build passed. Authenticated Chromium
  impersonated the live requestor identity and intercepted only the browser list
  response to add that identity as an explicit reviewer, without mutating the
  cluster. It verified only the latest Expired requestor transition, only the
  latest Requested reviewer transition, both actor Subject links, the Review
  action, default 24-hour scope, an empty 1-hour scope, restored all-time
  results, four-Namespace scope, and zero plugin runtime errors. The local and
  injected bundle SHA-256 is
  `2e5e4acc37e3824f0953766ebe12e8b15ade7e84cbaf31a1cae580ece55c952f`;
  Flux remains suspended and only the Headlamp server container was restarted.
- EventHub discovery is no longer limited to the Namespace filter on the page
  currently open. Its primary watch spans all Headlamp-permitted Namespaces so
  explicitly named reviewers see Requested work outside the selected UI scope;
  a failed all-Namespaces list falls back to the selected Namespace/query scope
  for restricted Tenant users. The obsolete Namespace-count chip was replaced
  by an Event type selector with All events, Action required, and Informational
  choices. Formatting, lint, TypeScript, all 273 tests across 60 files, and the
  production build passed. Authenticated Chromium injected only a browser-local
  Requested response in an unselected Namespace and verified it appeared for
  the explicit approver, retained Review, separated cleanly from informational
  transitions under both filters, removed the Namespace chip, and produced no
  plugin runtime errors. The cluster was not mutated. The local and injected
  bundle SHA-256 is
  `831429f2d1568b3eb6e59dc2aec86dc787f1cef7dcc89a89fd15e203343b7b5a`;
  Flux remains suspended and only the Headlamp server container was restarted.
- On 2026-09-04, the complete Catalog surface migrated to Capsule's renamed
  v1beta2 Resource Lease APIs: namespaced `ResourceLease` and
  `ResourceLeaseTemplate`, plus cluster-scoped `GlobalResourceLeaseTemplate`.
  Resource classes, canonical CRD routes, create/review/retry/expire requests,
  subject and tag correlation, overview statistics, EventHub, and CLI snippets
  use only the new API names. `status.request` is the sole request snapshot and
  the API phase/transition union excludes the presentation-only future
  Archiving milestone. Catalog is now a top-level sidebar group beside Capsule.
  Formatting, lint, TypeScript, all 273 tests across 60 files, and the production
  build passed. Authenticated Chromium verified the injected canonical Requests
  and Templates links, root Catalog visibility, and zero plugin runtime errors
  with a browser-local ResourceLease response. The current kind cluster does not
  yet have the three renamed CRDs installed, so its backend data was not mutated.
  The local and injected bundle SHA-256 is
  `230d546a06d2feefc349b35f889a5cf661f182c16b18bb3e7b0a65abb88a1f29`;
  Flux remains suspended and only the Headlamp server container was restarted.
- On 2026-09-09, the live GlobalResourceLeaseTemplate API contains
  `clusterrole-bindings`, labeled `company.com/consumer=tenants`. Alice's missing
  catalog entry was caused by stale generated GlobalProxySettings that still
  granted List on `globalbreakrequesttemplates`. The owning
  `GlobalTenantResource/capsule-proxy-settings` already used
  `globalresourceleasetemplates`, but its generation was 4 while
  `status.observedGeneration` was 3. Capsule resumed reconciliation during
  diagnosis, caught up to generation 4, and updated the generated policies;
  `solar-proxy-settings` then reported Ready at generation 7. The template also
  acquired `status.namespaces: ["*"]`. Authenticated Chromium verified Alice's
  combined Templates inventory contains `clusterrole-bindings` with Global /
  All Namespaces scope, and its list and named GET through Headlamp both return
  HTTP 200. Alice could also open the rich detail and see the template in the
  New ResourceLease picker, with no plugin runtime errors. No plugin or
  access-policy change was needed. When this recurs,
  check the generator's observed generation and the template's reported
  Namespace availability before changing frontend filtering or granting RBAC.
- On 2026-09-09, the Permits workflow enables generated names by default,
  accepts an optional Reason, and opens the created request's canonical detail
  while closing its wizard. Reviews show a yellow retention bubble with an
  embedded archive icon; denied requests retain their future Archiving marker
  even before the controller supplies `keepUntil`. Managed inventories retain
  controller-reported rows during failed live reads, consume nested processed
  status/messages and cluster scope, and replace refreshed live objects instead
  of ignoring watch updates. The main sidebar is **Tenants**, with nested
  **Permits → Requests / Templates**. Formatting, lint, TypeScript, 282 tests
  across 62 files, and the production build passed. Authenticated Chromium
  verified generated-name submission without Reason, the exact creation redirect
  and closed wizard, both retention modes, denied Archiving, and inventory rows
  under forbidden live GETs. Those browser checks intercepted fixture responses
  and the creation POST; no live ResourceLease was created, approved, or expired.
  The final local/injected bundle SHA-256 is
  `445a1fe996a8415c4ec7f7cb77cfd1bc6e50b6d3cda1a326f6c44c337cdbe6af`.
  Headlamp is ready and Flux remains suspended for the playground development
  injection.
- On 2026-09-09, the complete permit surface migrated from the ResourceLease
  names to `ResourcePermit`, `ResourcePermitTemplate`, and
  `GlobalResourcePermitTemplate`, still under `capsule.clastix.io/v1beta2`.
  `src/components/resource-permits/` and `src/resources/resourcePermits.ts` own
  the renamed implementation. Canonical/alias routes, API mutations, overview,
  EventHub, subject/tag correlation, managed-resource icons, authorization table
  IDs, and `kubectl capsule resource-permit` commands use the new names. Runtime
  source and the built bundle contain no retired lease API references; older
  verification entries above describe the names in use at the time.
  Formatting, lint, TypeScript, all 282 tests across 62 files, and the production
  build passed. Authenticated Chromium verified both template kinds' combined
  inventory and rich details, generated creation/redirect, retention modes,
  denied Archiving, nested processed-item state under forbidden live reads,
  and the renamed CLI. No retired endpoints or plugin runtime errors occurred.
  These checks used browser-local API fixtures and intercepted creation because
  the kind playground initially lacked the three ResourcePermit CRDs. They were
  installed externally during validation, but all three live inventories were
  still empty. A separate unmocked Alice check returned HTTP 200 for ResourcePermits
  in `solar-prod` and HTTP 403 for both the global template list and the namespaced
  template list in `solar-prod`. Generated `solar-proxy-settings` still granted
  List on `globalresourceleasetemplates`; backend template objects and matching
  template RBAC/proxy policies must migrate before Alice can use them. Backend
  resources and proxy policies were not changed. The local/injected bundle SHA-256 is
  `ab8e7d71a459c2d71c5c61317f95ea25dafd0718a138b49bf29a470a51e6ed02`;
  Headlamp is ready and Flux remains suspended for development injection.
- On 2026-09-09, ResourcePermit live inventory was empty when a selected Tenant
  excluded its managed targets' Namespaces. Reproduced on
  `solar-system/adad-7qv4h`: selecting Solar hid the two RoleBindings in
  `green-test` and `green-uat` from the table while the flow still showed both.
  The shared managed-resource table now bypasses the global Namespace filter
  and leaves text matching to Headlamp's column search. Formatting, lint,
  TypeScript, all 282 tests across 62 files, and the production build passed.
  Authenticated Chromium verified both rows with Solar selected using Alice's
  unmodified API responses (live RoleBinding reads returned 403), then verified
  populated links/ages and working name filters with browser-local successful
  RoleBinding responses. No cluster objects or permissions were changed.
  Playground reload/status confirmed Headlamp Ready and matching local/pod
  SHA-256 `d74ad7585e3160f18d6ef70e4f0624ad93a47a5784324217faa3dc3acc26d28e`.
- On 2026-10-09, the ResourcePermit creation wizard switched its request
  Namespace selector to the signed-in identity's Namespace list. Global
  creation templates no longer depend on `status.namespaces` for catalog
  visibility. Formatting, lint, TypeScript, all 291 tests across 62 files, and
  the production build passed. The Flux playground runs Headlamp chart 0.45.0;
  reload/status confirmed a Ready pod and matching local, injected, and
  browser-served SHA-256
  `89d64084f2c413b8cc21ef987608ab5f4a674e60c6a1fccafc76d541e29b2dcb`.
  Alice's real Namespace list was empty, and both template selectors correctly
  remained disabled. Browser-local permit and populated Namespace fixtures
  verified identical visible choices for Grafana and ClusterRole bindings,
  including a nonmatching active Namespace filter and template status. No
  browser errors or permit mutations occurred. This recreated cluster lacks
  all three ResourcePermit CRDs, so real request creation remains unavailable.
  The Headlamp HelmRelease remains suspended for the development injection.

## Resource Permits extraction (2026-10-12)

The standalone addon UI owns the three permit CRDs and their canonical and
legacy routes, the notification bell, and lifecycle actions. Capsule no longer
queries those APIs in its overview, subject drawer, or tag inventory. Historical
verification entries above retain the names and layout in use at the time.
