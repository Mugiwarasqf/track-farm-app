# Already created manually (CLI create-open-id-connect-provider was
# applied before this file existed) -- import before first apply:
#   terraform import aws_iam_openid_connect_provider.github_actions \
#     arn:aws:iam::<account_id>:oidc-provider/token.actions.githubusercontent.com
resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [var.github_oidc_thumbprint]
}

locals {
  owner = split("/", var.github_repo)[0]
  name  = split("/", var.github_repo)[1]
  # GitHub's sub claim: plain "repo:owner/name:..." or, since the repo
  # rename, "repo:owner@<id>/name@<id>:..." (confirmed via CloudTrail).
  # Both forms kept for each suffix.
  subs = {
    deploy = [
      "repo:${var.github_repo}:ref:refs/heads/main",
      "repo:${local.owner}@*/${local.name}@*:ref:refs/heads/main",
    ]
    plan = [
      "repo:${var.github_repo}:pull_request",
      "repo:${local.owner}@*/${local.name}@*:pull_request",
    ]
  }
}

# Two roles. "deploy" (admin) trusts only jobs running main's own code,
# with no `environment:` set (that changes the sub claim, and a PR branch
# could add one). "plan" (read-only) is all a pull request can assume, so
# editing a workflow in a PR can't reach admin.
data "aws_iam_policy_document" "github_actions_trust" {
  for_each = local.subs

  statement {
    effect = "Allow"
    # configure-aws-credentials@v4 tags the session; AWS rejects the whole
    # call unless TagSession is allowed too.
    actions = ["sts:AssumeRoleWithWebIdentity", "sts:TagSession"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = each.value
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "trackfarm-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust["deploy"].json
}

# AdministratorAccess for now, matching this project's established
# "simplicity for beta" pattern -- tighten to a scoped policy once the
# pipeline is proven and the exact permission set it needs is known.
resource "aws_iam_role_policy_attachment" "github_actions_admin" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# CI's terraform plan on pull requests. Read-only: plans run with
# -lock=false since the lock table write isn't allowed.
resource "aws_iam_role" "github_actions_plan" {
  name               = "trackfarm-github-actions-plan"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust["plan"].json
}

resource "aws_iam_role_policy_attachment" "github_actions_plan_readonly" {
  role       = aws_iam_role.github_actions_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}
