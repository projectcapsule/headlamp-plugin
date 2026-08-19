# In-cluster development environment

This environment runs Headlamp in Kubernetes and mounts the locally built
Capsule plugin into its plugin directory. It is optimized for kind but can use a
remote cluster when the plugin image is pushed to a registry.

The chart is pinned to Headlamp `0.44.0`. The initial plugin bundle comes from
the repository's `Dockerfile`. After deployment, `make headlamp-sync` rebuilds
the bundle and copies it through the `plugin-sync` sidecar. Headlamp watches the
shared plugin directory and reloads changed bundles.

## Reload an existing Flux playground installation

When the playground already installed Headlamp through a Flux `HelmRelease`, do
not run `make headlamp-deploy`: that target owns a separate Helm release. Use
the playground reload target instead:

```sh
make headlamp-playground-reload
```

The target discovers `flux-system/headlamp` and its target namespace, builds
the local bundle, suspends that HelmRelease, copies the plugin through the
chart's `headlamp-plugin` sidecar into the existing `/build/plugins` EmptyDir,
and restarts only the Headlamp server container. The pod is not replaced, so
the injected files survive the reload. Check the release, pod, and local/remote
bundle hashes with:

```sh
make headlamp-playground-status
```

After the development session, hand control back to Flux:

```sh
make headlamp-playground-resume
```

The injection is intentionally ephemeral. Resuming reconciliation leaves the
current files in place, but the next Helm rollout recreates the EmptyDir and
restores whatever plugin is configured in the playground Git source.

The playground script uses the current kube context by default. It supports
`KUBE_CONTEXT`, `FLUX_NAMESPACE`, `HEADLAMP_HELMRELEASE`,
`HEADLAMP_NAMESPACE`, `HEADLAMP_DEPLOYMENT`, `HEADLAMP_CONTAINER`,
`HEADLAMP_PLUGIN_CONTAINER`, `HEADLAMP_PLUGINS_DIR`, `PLUGIN_NAME`, and
`NODE_BIN` overrides. The installation must expose a writable shared plugin
volume through a sidecar; the playground chart's plugins manager provides it.

## Deploy to kind

Prerequisites are npm 11+, Docker, kind, kubectl, Helm, and an existing kind
cluster. Node.js 22 or 24 is supported; `.nvmrc` and `.node-version` both pin
Node 24 for common version managers. If the active Node is unsupported, the
script automatically uses an ephemeral Node 24 runtime through `npx`.

```sh
make headlamp-deploy
```

For a context that is not named `kind-<cluster name>`, provide both names:

```sh
KUBE_CONTEXT=my-context KIND_CLUSTER=my-kind-cluster make headlamp-deploy
```

The command installs dependencies when needed, builds the plugin, builds and
loads its image, installs or upgrades Headlamp, and waits for the deployment to
become ready. It normally uses `kind load docker-image`; if the installed kind
CLI cannot read a newer containerd configuration, it automatically imports the
same image through `ctr` on each kind node.

## Open Headlamp

In one terminal, keep the port-forward running:

```sh
make headlamp-port-forward
```

Open <http://127.0.0.1:8081>. In another terminal, generate a temporary login
token and paste it into Headlamp:

```sh
make headlamp-token
```

## Iterate on the plugin

After changing plugin source, run:

```sh
make headlamp-sync
```

This is the normal fast feedback loop. A full `make headlamp-deploy` is only
needed after changing the plugin image, chart values, or deployment tooling.
The fast sync writes into the current pod's `EmptyDir`, so it is intentionally
ephemeral. Run `make headlamp-deploy` before handing off a feature batch; that
rebuilds the plugin image and prevents a later pod recreation from restoring an
older bundle. A running port-forward is attached to the selected backing pod
and must also be restarted after a rollout or pod replacement.

Useful diagnostics:

```sh
make headlamp-status
make headlamp-logs
make headlamp-render
```

## Configuration overrides

The scripts accept these environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `KUBE_CONTEXT` | current context | Target Kubernetes context |
| `HEADLAMP_NAMESPACE` | `capsule-system` | Deployment namespace |
| `HEADLAMP_CHART_VERSION` | `0.44.0` | Pinned chart version |
| `HEADLAMP_PORT` | `8081` | Local port-forward port |
| `PLUGIN_IMAGE` | `capsule-headlamp-plugin:dev` | Development image reference |
| `PLUGIN_PULL_POLICY` | `Never` on kind | Init-container pull policy |
| `KIND_CLUSTER` | inferred from context | kind cluster name |
| `PUSH_PLUGIN_IMAGE` | `0` | Push the image for a non-kind cluster |
| `NODE_BIN` | automatic | Explicit Node 22/24 executable |

For a non-kind cluster, use a registry reference and explicitly allow the push:

```sh
KUBE_CONTEXT=my-cluster \
PLUGIN_IMAGE=registry.example.com/capsule-headlamp-plugin:dev \
PUSH_PLUGIN_IMAGE=1 \
make headlamp-deploy
```

## Security boundary

The development service account is bound to Kubernetes' built-in
`cluster-admin` role. This intentionally allows every cluster-scoped and
namespaced action so the complete Headlamp and Capsule UI can be exercised in
the disposable development cluster. Do not reuse this binding in a shared or
production cluster; replace it with roles scoped to the APIs and verbs that the
installation actually needs. Headlamp still requires a login token, the service
is only a `ClusterIP`, and the documented port-forward binds to localhost.

Remove the Helm release with `make headlamp-undeploy`. The namespace is kept so
other development resources in it are not deleted unexpectedly.
