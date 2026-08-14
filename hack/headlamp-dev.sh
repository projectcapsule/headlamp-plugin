#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
VALUES_FILE="$REPO_ROOT/deploy/headlamp/values.yaml"

KUBE_CONTEXT=${KUBE_CONTEXT:-$(kubectl config current-context 2>/dev/null || true)}
HEADLAMP_NAMESPACE=${HEADLAMP_NAMESPACE:-capsule-system}
HEADLAMP_RELEASE=${HEADLAMP_RELEASE:-capsule-headlamp}
HEADLAMP_CHART_VERSION=${HEADLAMP_CHART_VERSION:-0.44.0}
HEADLAMP_TIMEOUT=${HEADLAMP_TIMEOUT:-5m}
HEADLAMP_PORT=${HEADLAMP_PORT:-8081}
PLUGIN_IMAGE=${PLUGIN_IMAGE:-capsule-headlamp-plugin:dev}
PLUGIN_PULL_POLICY=${PLUGIN_PULL_POLICY:-}
PUSH_PLUGIN_IMAGE=${PUSH_PLUGIN_IMAGE:-0}
NODE_BIN=${NODE_BIN:-node}
USE_NPX_NODE=0

usage() {
  cat <<'EOF'
Usage: hack/headlamp-dev.sh <command>

Commands:
  deploy        Build the plugin image, load/push it, and install Headlamp
  sync          Rebuild and copy the plugin into the running Headlamp pod
  render        Render the pinned Headlamp chart without changing the cluster
  status        Show the development deployment and plugin files
  token         Print a temporary login token for the Headlamp service account
  port-forward  Serve Headlamp at http://127.0.0.1:8081
  logs          Follow the Headlamp server logs
  undeploy      Remove the Helm release (the namespace is preserved)

Environment overrides:
  KUBE_CONTEXT             kubectl context (default: current context)
  HEADLAMP_NAMESPACE       namespace (default: capsule-system)
  HEADLAMP_CHART_VERSION   chart version (default: 0.44.0)
  HEADLAMP_PORT            local port-forward port (default: 8081)
  PLUGIN_IMAGE             plugin image reference
  PLUGIN_PULL_POLICY       Never, IfNotPresent, or Always
  PUSH_PLUGIN_IMAGE=1      push PLUGIN_IMAGE for a non-kind cluster
  KIND_CLUSTER             kind cluster name when it cannot be inferred
  NODE_BIN                 Node 22/24 binary (falls back to npx node@24)
EOF
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_context() {
  [ -n "$KUBE_CONTEXT" ] || fail "no Kubernetes context selected; set KUBE_CONTEXT"
  kubectl --context "$KUBE_CONTEXT" cluster-info >/dev/null
}

kind_cluster_name() {
  if [ -n "${KIND_CLUSTER:-}" ]; then
    printf '%s\n' "$KIND_CLUSTER"
    return
  fi

  case "$KUBE_CONTEXT" in
    kind-*) printf '%s\n' "${KUBE_CONTEXT#kind-}" ;;
    *) return 1 ;;
  esac
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
}

build_image() {
  need docker
  build_bundle
  docker build --tag "$PLUGIN_IMAGE" "$REPO_ROOT"
}

load_kind_image() {
  cluster_name=$1

  if kind load docker-image --name "$cluster_name" "$PLUGIN_IMAGE"; then
    return
  fi

  printf '%s\n' \
    'kind image loading failed; importing through containerd on each node...'
  image_archive=$(mktemp "${TMPDIR:-/tmp}/capsule-headlamp-plugin.XXXXXX.tar")
  trap 'rm -f "$image_archive"' EXIT HUP INT TERM
  docker save --output "$image_archive" "$PLUGIN_IMAGE"

  nodes=$(kind get nodes --name "$cluster_name")
  [ -n "$nodes" ] || fail "kind cluster has no nodes: $cluster_name"
  for node in $nodes; do
    docker exec --interactive "$node" \
      ctr --namespace k8s.io images import - < "$image_archive"
  done

  rm -f "$image_archive"
  trap - EXIT HUP INT TERM
}

prepare_image() {
  build_image

  if cluster_name=$(kind_cluster_name); then
    need kind
    load_kind_image "$cluster_name"
    PLUGIN_PULL_POLICY=${PLUGIN_PULL_POLICY:-Never}
    return
  fi

  [ "$PUSH_PLUGIN_IMAGE" = "1" ] || fail \
    "non-kind contexts require a pullable PLUGIN_IMAGE and PUSH_PLUGIN_IMAGE=1"
  docker push "$PLUGIN_IMAGE"
  PLUGIN_PULL_POLICY=${PLUGIN_PULL_POLICY:-Always}
}

ensure_chart_repo() {
  need helm
  helm repo add headlamp https://kubernetes-sigs.github.io/headlamp/ --force-update >/dev/null
}

bundle_revision() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$REPO_ROOT/dist/main.js" | awk '{print $1}'
  else
    shasum -a 256 "$REPO_ROOT/dist/main.js" | awk '{print $1}'
  fi
}

headlamp_pod() {
  # During a rollout the previous pod can remain Running while terminating.
  # Sorting by creation time and selecting the newest Ready pod avoids syncing
  # or reporting the stale EmptyDir from the outgoing replica.
  pod=$(kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" get pods \
    --selector app.kubernetes.io/part-of=capsule-headlamp-development \
    --field-selector status.phase=Running \
    --sort-by=.metadata.creationTimestamp \
    --output jsonpath='{.items[-1:].metadata.name}')
  [ -n "$pod" ] || fail "no running Capsule Headlamp development pod found"
  printf '%s\n' "$pod"
}

deploy() {
  need kubectl
  require_context
  prepare_image
  ensure_chart_repo

  revision=$(bundle_revision)
  namespace_option=
  if ! kubectl --context "$KUBE_CONTEXT" get namespace "$HEADLAMP_NAMESPACE" >/dev/null 2>&1; then
    namespace_option=--create-namespace
  fi
  helm upgrade --install "$HEADLAMP_RELEASE" headlamp/headlamp \
    --kube-context "$KUBE_CONTEXT" \
    --namespace "$HEADLAMP_NAMESPACE" \
    ${namespace_option:+$namespace_option} \
    --version "$HEADLAMP_CHART_VERSION" \
    --values "$VALUES_FILE" \
    --set-string "initContainers[0].image=$PLUGIN_IMAGE" \
    --set-string "initContainers[0].imagePullPolicy=$PLUGIN_PULL_POLICY" \
    --set-string "podAnnotations.capsule-headlamp-dev-revision=$revision" \
    --wait \
    --timeout "$HEADLAMP_TIMEOUT"

  status
  printf '\nHeadlamp is ready. Run:\n'
  printf '  make headlamp-port-forward\n'
  printf '  make headlamp-token\n'
}

sync() {
  need kubectl
  require_context
  build_bundle
  pod=$(headlamp_pod)

  kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" cp \
    "$REPO_ROOT/dist/main.js" "$pod:/headlamp/plugins/capsule/main.js" \
    --container plugin-sync
  kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" cp \
    "$REPO_ROOT/package.json" "$pod:/headlamp/plugins/capsule/package.json" \
    --container plugin-sync
  kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" exec \
    "$pod" --container plugin-sync -- test -s /headlamp/plugins/capsule/main.js

  printf 'Plugin rebuilt and synchronized to pod %s.\n' "$pod"
  printf '%s\n' \
    'Fast sync uses the pod-local EmptyDir; run make headlamp-deploy before hand-off to persist it across pod recreation.'
}

render() {
  ensure_chart_repo
  helm template "$HEADLAMP_RELEASE" headlamp/headlamp \
    --namespace "$HEADLAMP_NAMESPACE" \
    --version "$HEADLAMP_CHART_VERSION" \
    --values "$VALUES_FILE" \
    --set-string "initContainers[0].image=$PLUGIN_IMAGE" \
    --set-string "initContainers[0].imagePullPolicy=${PLUGIN_PULL_POLICY:-Never}"
}

status() {
  need kubectl
  require_context
  kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" get \
    deployment/capsule-headlamp service/capsule-headlamp
  kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" get pods \
    --selector app.kubernetes.io/part-of=capsule-headlamp-development

  pod=$(headlamp_pod)
  kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" exec \
    "$pod" --container plugin-sync -- ls -l /headlamp/plugins/capsule
}

token() {
  need kubectl
  require_context
  kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" \
    create token capsule-headlamp
}

port_forward() {
  need kubectl
  require_context
  printf 'Serving Headlamp at http://127.0.0.1:%s (Ctrl-C to stop).\n' "$HEADLAMP_PORT"
  kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" \
    port-forward service/capsule-headlamp "$HEADLAMP_PORT:80"
}

logs() {
  need kubectl
  require_context
  kubectl --context "$KUBE_CONTEXT" --namespace "$HEADLAMP_NAMESPACE" \
    logs deployment/capsule-headlamp --container headlamp --follow
}

undeploy() {
  need helm
  require_context
  helm uninstall "$HEADLAMP_RELEASE" \
    --kube-context "$KUBE_CONTEXT" \
    --namespace "$HEADLAMP_NAMESPACE"
}

case "${1:-}" in
  deploy) deploy ;;
  sync) sync ;;
  render) render ;;
  status) status ;;
  token) token ;;
  port-forward) port_forward ;;
  logs) logs ;;
  undeploy) undeploy ;;
  help|-h|--help|'') usage ;;
  *) usage >&2; fail "unknown command: $1" ;;
esac
