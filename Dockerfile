FROM busybox:1.37.0

RUN ["/bin/mkdir", "-p", "/plugins/capsule"]

COPY dist/main.js /plugins/capsule/main.js
COPY package.json /plugins/capsule/package.json
