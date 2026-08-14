.PHONY: \
	headlamp-deploy \
	headlamp-sync \
	headlamp-render \
	headlamp-status \
	headlamp-token \
	headlamp-port-forward \
	headlamp-logs \
	headlamp-undeploy

headlamp-deploy:
	./hack/headlamp-dev.sh deploy

headlamp-sync:
	./hack/headlamp-dev.sh sync

headlamp-render:
	./hack/headlamp-dev.sh render

headlamp-status:
	./hack/headlamp-dev.sh status

headlamp-token:
	./hack/headlamp-dev.sh token

headlamp-port-forward:
	./hack/headlamp-dev.sh port-forward

headlamp-logs:
	./hack/headlamp-dev.sh logs

headlamp-undeploy:
	./hack/headlamp-dev.sh undeploy

