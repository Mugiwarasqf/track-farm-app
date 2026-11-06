variable "aws_region" {
  description = "AWS region for this account's resources."
  type        = string
  default     = "eu-west-1"
}

# Bootstrap only ever targets prod (CI/CD never deploys to beta) -- pinned
# the same way as infra/'s own providers.tf, see that file's comment.
variable "aws_profile" {
  description = "Named AWS CLI profile this provider authenticates as."
  type        = string
  default     = "poultry-prod"
}

variable "aws_account_id" {
  description = "AWS account ID this must deploy into -- see providers.tf's allowed_account_ids."
  type        = string
  default     = "685108783257"
}

variable "github_repo" {
  description = "GitHub repo (owner/name) allowed to assume the CI/CD role."
  type        = string
  default     = "Mugiwarasqf/track-farm-app"
}

# AWS no longer actually validates this against GitHub's cert for the
# well-known token.actions.githubusercontent.com provider, but the API
# still requires a well-formed 40-char SHA1 hex value. Fetched directly
# from GitHub's real cert chain on 11/10/2026 -- refetch with:
#   openssl s_client -servername token.actions.githubusercontent.com \
#     -showcerts -connect token.actions.githubusercontent.com:443 </dev/null
# and take the top intermediate CA's fingerprint if this ever needs to
# change (cert rotation won't require it; provider migration might).
variable "github_oidc_thumbprint" {
  description = "SHA1 thumbprint of the GitHub OIDC provider's TLS cert chain."
  type        = string
  default     = "ab9d0263244dd0326eb67015705a667e79cfe998"
}
