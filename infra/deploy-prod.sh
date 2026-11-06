#!/usr/bin/env bash
# Usage: ./deploy-prod.sh plan | apply | destroy | output ...
# Backend, profile, and account are all pinned here and in prod.tfvars --
# no flags to remember or forget.
#
# Policy: prod's infra/ stack deploys through cd.yml (CI/CD), not from
# here. This script is for the rare exception -- initial stand-up or a
# genuine break-glass emergency -- not routine use.
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-}" = "apply" ]; then
  echo "Prod deploys normally go through CI/CD (cd.yml), not this script."
  read -r -p "Applying to prod locally -- are you sure? [y/N] " confirm
  [ "$confirm" = "y" ] || [ "$confirm" = "Y" ] || exit 1
fi

terraform init -backend-config=backend-configs/prod.hcl -reconfigure
terraform "$@" -var-file=prod.tfvars
