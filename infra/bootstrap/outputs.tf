output "github_actions_role_arn" {
  description = "Set as AWS_ROLE_ARN in the repo's GitHub Actions secrets/vars."
  value       = aws_iam_role.github_actions.arn
}

output "github_actions_plan_role_arn" {
  description = "Set as AWS_PLAN_ROLE_ARN in the repo's GitHub Actions vars (CI's PR plans)."
  value       = aws_iam_role.github_actions_plan.arn
}
