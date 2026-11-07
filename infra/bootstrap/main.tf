# Already created manually (CLI create-open-id-connect-provider was
# applied before this file existed) -- import before first apply:
#   terraform import aws_iam_openid_connect_provider.github_actions \
#     arn:aws:iam::<account_id>:oidc-provider/token.actions.githubusercontent.com
resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [var.github_oidc_thumbprint]
}

data "aws_iam_policy_document" "github_actions_trust" {
  statement {
    effect = "Allow"
    # TagSession is required alongside AssumeRoleWithWebIdentity: by default
    # aws-actions/configure-aws-credentials@v4 attaches GitHub context (repo,
    # actor, workflow...) as session tags on the call, and AWS rejects the
    # whole AssumeRoleWithWebIdentity call -- not just the tagging -- if the
    # trust policy doesn't also allow TagSession.
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

    # pull_request covers CI's plan step on every PR; ref:refs/heads/main
    # covers CD's apply step after merge. GitHub's sub claim now embeds
    # immutable owner/repo IDs (repo:owner@<id>/name@<id>:...) instead of
    # the plain owner/name text alone -- confirmed via CloudTrail after this
    # repo's rename, where the plain-text pattern below matched nothing and
    # every AssumeRoleWithWebIdentity call was denied. Both forms are kept:
    # the ID-suffixed one is what GitHub actually sends today, the plain one
    # is harmless to keep in case that ever changes back.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_repo}:pull_request",
        "repo:${var.github_repo}:ref:refs/heads/main",
        "repo:${split("/", var.github_repo)[0]}@*/${split("/", var.github_repo)[1]}@*:pull_request",
        "repo:${split("/", var.github_repo)[0]}@*/${split("/", var.github_repo)[1]}@*:ref:refs/heads/main",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "trackfarm-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_actions_trust.json
}

# AdministratorAccess for now, matching this project's established
# "simplicity for beta" pattern -- tighten to a scoped policy once the
# pipeline is proven and the exact permission set it needs is known.
resource "aws_iam_role_policy_attachment" "github_actions_admin" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}
