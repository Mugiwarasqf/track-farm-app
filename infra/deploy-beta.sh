#!/usr/bin/env bash
# Usage: ./deploy-beta.sh plan | apply | destroy | output ...
# Backend, profile, and account are all pinned here and in
# terraform.tfvars -- no flags to remember or forget.
set -euo pipefail
cd "$(dirname "$0")"
terraform init -backend-config=backend-configs/beta.hcl -reconfigure
terraform "$@"
