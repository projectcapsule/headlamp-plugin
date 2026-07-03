# renovate: datasource=docker depName=stagex/core-busybox versioning=loose
ARG BUSYBOX_IMAGE=stagex/core-busybox:sx2026.03.0@sha256:4f3e3849acb54972e7c4f1d08c320526e0f8b314130bda68f83f821b02b4890b

# Import the pinned image so we can COPY from it (workaround for --from + ARG).
FROM ${BUSYBOX_IMAGE} AS busybox

# Layout stage: temporarily bring in mkdir to create the directory tree.
# This stage's tools are discarded; only the resulting /plugins tree is used.
FROM scratch AS layout

COPY --from=busybox /bin/mkdir /bin/mkdir
COPY --from=busybox /usr/bin/mkdir /usr/bin/mkdir

RUN ["/bin/mkdir", "-p", "/plugins/capsule"]
COPY dist/main.js /plugins/capsule/main.js
COPY package.json /plugins/capsule/package.json

# Final image: minimal for use as an initContainer volume image.
FROM scratch

# cp is needed at runtime to support the documented pattern:
#   command: ['/bin/cp', '-r', '/plugins/capsule', '/target/plugins']
# mkdir is build-time only and not included here.
COPY --from=busybox /bin/cp  /bin/cp
COPY --from=busybox /usr/bin/cp /usr/bin/cp

COPY --from=layout /plugins /plugins

# OCI image labels (annotations / tags)
LABEL org.opencontainers.image.source="https://github.com/projectcapsule/headlamp-plugin"
LABEL org.opencontainers.image.description="Capsule multi-tenancy plugin for Headlamp"
LABEL org.opencontainers.image.licenses="Apache-2.0"
