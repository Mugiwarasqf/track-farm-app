bucket = "trackfarm-tfstate-685108783257"
region = "eu-west-1"
# No profile here on purpose -- ci.yml's terraform job reads this file
# directly and has no named profile (it authenticates via an OIDC-assumed
# role's env-var credentials). deploy-prod.sh appends profile locally as
# an extra -backend-config flag instead of baking it in here.
