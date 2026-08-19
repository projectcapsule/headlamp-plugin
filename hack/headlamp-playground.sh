#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

KUBE_CONTEXT=${KUBE_CONTEXT:-$(kubectl config current-context 2>/dev/null || true)}
FLUX_NAMESPACE=${FLUX_NAMESPACE:-flux-system}
HEADLAMP_HELMRELEASE=${HEADLAMP_HELMRELEASE:-headlamp}
HEADLAMP_NAMESPACE=${HEADLAMP_NAMESPACE:-}
HEADLAMP_DEPLOYMENT=${HEADLAMP_DEPLOYMENT:-}
HEADLAMP_CONTAINER=${HEADLAMP_CONTAINER:-headlamp}
HEADLAMP_PLUGIN_CONTAINER=${HEADLAMP_PLUGIN_CONTAINER:-headlamp-plugin}
HEADLAMP_PLUGINS_DIR=${HEADLAMP_PLUGINS_DIR:-/build/plugins}
PLUGIN_NAME=${PLUGIN_NAME:-capsule}
NODE_BIN=${NODE_BIN:-node}
USE_NPX_NODE=0

usage() {
  cat <<'EOF'
Usage: hack/headlamp-playground.sh <command>

Commands:
  reload  Suspend the Flux HelmRelease, build and inject the local plugin, and
          restart only the Headlamp container so it reloads the plugin cache
  status  Show the HelmRelease, workload, pod, and injected plugin checksum
  resume  Resume Flux reconciliation for the Headlamp HelmRelease

Environment overrides:
  KUBE_CONTEXT               kubectl context (default: current context)
  FLUX_NAMESPACE             HelmRelease namespace (default: flux-system)
  HEADLAMP_HELMRELEASE       HelmRelease name (default: headlamp)
  HEADLAMP_NAMESPACE         workload namespace (default: HelmRelease target)
  HEADLAMP_DEPLOYMENT        deployment name (default: discovered from Flux labels)
  HEADLAMP_CONTAINER         server container (default: headlamp)
  HEADLAMP_PLUGIN_CONTAINER  writable plugin sidecar (default: headlamp-plugin)
  HEADLAMP_PLUGINS_DIR       shared plugin directory (default: /build/plugins)
  PLUGIN_NAME                destination directory name (default: capsule)
  NODE_BIN                   Node 22/24 binary (falls back to npx node@24)

The reload is intentionally pod-local. Resuming Flux is safe, but a later Helm
rollout recreates the EmptyDir and restores the plugin configured in Git.
EOF
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_cluster() {
  need kubectl
  [ -n "$KUBE_CONTEXT" ] || fail "no Kubernetes context selected; set KUBE_CONTEXT"
  kubectl --context "$KUBE_CONTEXT" cluster-info >/dev/null
  kubectl --context "$KUBE_CONTEXT" --namespace "$FLUX_NAMESPACE" get \
    helmrelease.helm.toolkit.fluxcd.io "$HEADLAMP_HELMRELEASE" >/dev/null
}

ensure_dependencies() {
  need npm
  if command -v "$NODE_BIN" >/dev/null 2>&1; then
    node_major=$($NODE_BIN -p 'process.versions.node.split(".")[0]')
  else
    node_major=
  fi

  case "$node_major" in
    22|24) USE_NPX_NODE=0 ;;
    *)
      [ "$NODE_BIN" = "node" ] || fail \
        "NODE_BIN is not Node 22/24: $NODE_BIN"
      need npx
      USE_NPX_NODE=1
      printf '%s\n' 'Node 22/24 not found; using an ephemeral Node 24 runtime via npx.'
      ;;
  esac

  if [ ! -x "$REPO_ROOT/node_modules/.bin/headlamp-plugin" ]; then
    (cd "$REPO_ROOT" && npm ci)
  fi
}

run_node() {
  if [ "$USE_NPX_NODE" = "1" ]; then
    npx --yes node@24 "$@"
  else
    "$NODE_BIN" "$@"
  fi
}

build_bundle() {
  ensure_dependencies
  (cd "$REPO_ROOT" && run_node \
    node_modules/@kinvolk/headlamp-plugin/bin/headlamp-plugin.js build)
  [ -s "$REPO_ROOT/dist/main.js" ] || fail "plugin build did not create dist/main.js"
}

target_namespace() {
  if [ -n "$HEADLAMP_NAMESPACE" ]; then
    printf '%s\n' "$HEADLAMP_NAMESPACE"
    return
  fi

  namespace=$(kubectl --context "$KUBE_CONTEXT" --namespace "$FLUX_NAMESPACE" get \
    helmrelease.helm.toolkit.fluxcd.io "$HEADLAMP_HELMRELEASE" \
    --output jsonpath='{.spec.targetNamespace}')
  [ -n "$namespace" ] || namespace=$FLUX_NAMESPACE
  printf '%s\n' "$namespace"
}

deployment_name() {
  namespace=$1
  if [ -n "$HEADLAMP_DEPLOYMENT" ]; then
    printf '%s\n' "$HEADLAMP_DEPLOYMENT"
    return
  fi

  deployment=$(kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" get deployments \
    --selector "helm.toolkit.fluxcd.io/name=$HEADLAMP_HELMRELEASE,helm.toolkit.fluxcd.io/namespace=$FLUX_NAMESPACE" \
    --output jsonpath='{.items[0].metadata.name}')
  [ -n "$deployment" ] || fail \
    "no Deployment owned by $FLUX_NAMESPACE/$HEADLAMP_HELMRELEASE found in $namespace"
  printf '%s\n' "$deployment"
}

release_name() {
  release=$(kubectl --context "$KUBE_CONTEXT" --namespace "$FLUX_NAMESPACE" get \
    helmrelease.helm.toolkit.fluxcd.io "$HEADLAMP_HELMRELEASE" \
    --output jsonpath='{.spec.releaseName}')
  [ -n "$release" ] || release=$HEADLAMP_HELMRELEASE
  printf '%s\n' "$release"
}

headlamp_pod() {
  namespace=$1
  release=$2
  pod=$(kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" get pods \
    --selector "app.kubernetes.io/name=headlamp,app.kubernetes.io/instance=$release" \
    --field-selector status.phase=Running \
    --sort-by=.metadata.creationTimestamp \
    --output jsonpath='{.items[-1:].metadata.name}')
  [ -n "$pod" ] || fail "no running Headlamp pod found for release $release"
  printf '%s\n' "$pod"
}

require_container() {
  namespace=$1
  deployment=$2
  container=$3
  containers=$(kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" get \
    deployment "$deployment" \
    --output jsonpath='{.spec.template.spec.containers[*].name}')
  case " $containers " in
    *" $container "*) ;;
    *) fail "Deployment $namespace/$deployment has no $container container (found: $containers)" ;;
  esac
}

suspend_release() {
  printf 'Suspending Flux HelmRelease %s/%s...\n' \
    "$FLUX_NAMESPACE" "$HEADLAMP_HELMRELEASE"
  kubectl --context "$KUBE_CONTEXT" --namespace "$FLUX_NAMESPACE" patch \
    helmrelease.helm.toolkit.fluxcd.io "$HEADLAMP_HELMRELEASE" \
    --type merge --patch '{"spec":{"suspend":true}}' >/dev/null
}

container_restart_count() {
  namespace=$1
  pod=$2
  kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" get pod "$pod" \
    --output "jsonpath={.status.containerStatuses[?(@.name=='$HEADLAMP_CONTAINER')].restartCount}"
}

restart_headlamp_container() {
  namespace=$1
  pod=$2
  previous_restarts=$(container_restart_count "$namespace" "$pod")
  [ -n "$previous_restarts" ] || previous_restarts=0

  printf 'Restarting only container %s in pod %s to reload the plugin cache...\n' \
    "$HEADLAMP_CONTAINER" "$pod"
  kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" exec "$pod" \
    --container "$HEADLAMP_CONTAINER" -- sh -c 'kill -TERM 1' >/dev/null 2>&1 || true

  attempts=0
  while [ "$attempts" -lt 60 ]; do
    current_restarts=$(container_restart_count "$namespace" "$pod" 2>/dev/null || true)
    if [ -n "$current_restarts" ] && [ "$current_restarts" -gt "$previous_restarts" ]; then
      kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" wait \
        --for=condition=Ready "pod/$pod" --timeout=60s >/dev/null
      return
    fi
    attempts=$((attempts + 1))
    sleep 1
  done

  fail "Headlamp container did not restart within 60 seconds"
}

remote_checksum() {
  namespace=$1
  pod=$2
  kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" exec "$pod" \
    --container "$HEADLAMP_PLUGIN_CONTAINER" -- \
    sha256sum "$HEADLAMP_PLUGINS_DIR/$PLUGIN_NAME/main.js" 2>/dev/null | awk '{print $1}'
}

local_checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$REPO_ROOT/dist/main.js" | awk '{print $1}'
  else
    shasum -a 256 "$REPO_ROOT/dist/main.js" | awk '{print $1}'
  fi
}

reload() {
  require_cluster
  namespace=$(target_namespace)
  deployment=$(deployment_name "$namespace")
  release=$(release_name)
  require_container "$namespace" "$deployment" "$HEADLAMP_CONTAINER"
  require_container "$namespace" "$deployment" "$HEADLAMP_PLUGIN_CONTAINER"

  build_bundle
  suspend_release
  kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" rollout status \
    "deployment/$deployment" --timeout=2m >/dev/null
  pod=$(headlamp_pod "$namespace" "$release")

  destination="$HEADLAMP_PLUGINS_DIR/$PLUGIN_NAME"
  kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" exec "$pod" \
    --container "$HEADLAMP_PLUGIN_CONTAINER" -- mkdir -p "$destination"
  kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" cp \
    "$REPO_ROOT/dist/main.js" "$pod:$destination/main.js" \
    --container "$HEADLAMP_PLUGIN_CONTAINER"
  kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" cp \
    "$REPO_ROOT/package.json" "$pod:$destination/package.json" \
    --container "$HEADLAMP_PLUGIN_CONTAINER"

  expected=$(local_checksum)
  actual=$(remote_checksum "$namespace" "$pod")
  [ "$expected" = "$actual" ] || fail \
    "plugin checksum mismatch (local $expected, pod $actual)"

  restart_headlamp_container "$namespace" "$pod"
  printf 'Local plugin %s loaded into %s/%s (SHA-256 %s).\n' \
    "$PLUGIN_NAME" "$namespace" "$pod" "$actual"
  printf '%s\n' \
    'Refresh Headlamp in the browser. Run make headlamp-playground-resume when the development session is finished.'
}

status() {
  require_cluster
  namespace=$(target_namespace)
  deployment=$(deployment_name "$namespace")
  release=$(release_name)
  require_container "$namespace" "$deployment" "$HEADLAMP_PLUGIN_CONTAINER"
  pod=$(headlamp_pod "$namespace" "$release")

  kubectl --context "$KUBE_CONTEXT" --namespace "$FLUX_NAMESPACE" get \
    helmrelease.helm.toolkit.fluxcd.io "$HEADLAMP_HELMRELEASE" \
    --output custom-columns='NAME:.metadata.name,SUSPENDED:.spec.suspend,READY:.status.conditions[?(@.type=="Ready")].status,MESSAGE:.status.conditions[?(@.type=="Ready")].message'
  kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" get \
    "deployment/$deployment" "pod/$pod"
  kubectl --context "$KUBE_CONTEXT" --namespace "$namespace" exec "$pod" \
    --container "$HEADLAMP_PLUGIN_CONTAINER" -- \
    ls -l "$HEADLAMP_PLUGINS_DIR/$PLUGIN_NAME" 2>/dev/null || \
    printf 'Plugin directory is not present: %s/%s\n' "$HEADLAMP_PLUGINS_DIR" "$PLUGIN_NAME"

  if [ -s "$REPO_ROOT/dist/main.js" ]; then
    expected=$(local_checksum)
    actual=$(remote_checksum "$namespace" "$pod" || true)
    printf 'Local SHA-256: %s\n' "$expected"
    printf 'Pod SHA-256:   %s\n' "${actual:-not installed}"
  fi
}

resume() {
  require_cluster
  printf 'Resuming Flux HelmRelease %s/%s...\n' \
    "$FLUX_NAMESPACE" "$HEADLAMP_HELMRELEASE"
  kubectl --context "$KUBE_CONTEXT" --namespace "$FLUX_NAMESPACE" patch \
    helmrelease.helm.toolkit.fluxcd.io "$HEADLAMP_HELMRELEASE" \
    --type merge --patch '{"spec":{"suspend":false}}' >/dev/null
  kubectl --context "$KUBE_CONTEXT" --namespace "$FLUX_NAMESPACE" annotate \
    helmrelease.helm.toolkit.fluxcd.io "$HEADLAMP_HELMRELEASE" \
    "reconcile.fluxcd.io/requestedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --overwrite >/dev/null
  printf '%s\n' \
    'Flux reconciliation resumed. The injected plugin remains until Headlamp is rolled out again.'
}

case "${1:-}" in
  reload) reload ;;
  status) status ;;
  resume) resume ;;
  help|-h|--help|'') usage ;;
  *) usage >&2; fail "unknown command: $1" ;;
esac
