bucket = "trackfarm-tfstate-543613943899"
region = "eu-west-1"
# No profile here on purpose -- this file is also read directly by CI,
# which has no named profile (it authenticates via an OIDC-assumed role's
# env-var credentials). deploy-beta.sh appends profile locally as an
# extra -backend-config flag instead of baking it in here.
