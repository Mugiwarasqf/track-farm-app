#!/usr/bin/env bash
# One-time setup for phone notifications (Web Push) in ONE AWS account.
#
# Creates a VAPID key pair, stores the PRIVATE key straight into SSM
# Parameter Store as a SecureString (it's never printed or written to disk),
# and prints the PUBLIC key for you to put in that environment's tfvars as
# vapid_public_key (and, for prod, the VAPID_PUBLIC_KEY repo variable that
# ci.yml/cd.yml pass in).
#
# Usage (from the repo root, with that account's AWS credentials active):
#   infra/scripts/create-vapid-keys.sh <project_name> <environment>
#   e.g. infra/scripts/create-vapid-keys.sh poultry-farm-app beta
#
# Run it once per environment. It refuses to replace an existing key:
# rotating the key silently breaks notifications on every phone that already
# turned them on, so that has to be a deliberate, separate decision.
set -euo pipefail

PROJECT="${1:?usage: create-vapid-keys.sh <project_name> <environment>}"
ENVIRONMENT="${2:?usage: create-vapid-keys.sh <project_name> <environment>}"
PARAM="/${PROJECT}/${ENVIRONMENT}/vapid-private-key"

if aws ssm get-parameter --name "$PARAM" >/dev/null 2>&1; then
  echo "A key already exists at $PARAM. Not replacing it." >&2
  echo "Its public key is whatever vapid_public_key is set to for this environment." >&2
  exit 1
fi

KEYS_JSON="$(node -e "console.log(JSON.stringify(require('./backend/node_modules/web-push').generateVAPIDKeys()))")"
PUBLIC_KEY="$(printf '%s' "$KEYS_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).publicKey))")"
PRIVATE_KEY="$(printf '%s' "$KEYS_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).privateKey))")"
unset KEYS_JSON

aws ssm put-parameter \
  --name "$PARAM" \
  --type SecureString \
  --value "$PRIVATE_KEY" \
  --description "TrackFarm Web Push (VAPID) private key - read by the reminder Lambdas" \
  >/dev/null
unset PRIVATE_KEY

echo "Private key stored in SSM at $PARAM"
echo
echo "Public key (add to this environment's tfvars as vapid_public_key):"
echo "$PUBLIC_KEY"
