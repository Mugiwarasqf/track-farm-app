output "table_names" {
  description = "Map of logical table key to actual table name — passed straight into api_lambdas as Lambda env vars."
  value = {
    farms                 = aws_dynamodb_table.farms.name
    batches               = aws_dynamodb_table.batches.name
    users                 = aws_dynamodb_table.users.name
    mortality_logs        = aws_dynamodb_table.mortality_logs.name
    feed_logs             = aws_dynamodb_table.feed_logs.name
    egg_logs              = aws_dynamodb_table.egg_logs.name
    vaccination_records   = aws_dynamodb_table.vaccination_records.name
    vaccination_schedules = aws_dynamodb_table.vaccination_schedules.name
    feed_purchases        = aws_dynamodb_table.feed_purchases.name
    weight_logs           = aws_dynamodb_table.weight_logs.name
    sick_bay              = aws_dynamodb_table.sick_bay.name
    suppressed_emails     = aws_dynamodb_table.suppressed_emails.name
    push_subscriptions    = aws_dynamodb_table.push_subscriptions.name
    supplements           = aws_dynamodb_table.supplements.name
    sales                 = aws_dynamodb_table.sales.name
    medicine_purchases    = aws_dynamodb_table.medicine_purchases.name
  }
}

output "table_arns" {
  description = "Every table + GSI ARN the api_lambdas module's IAM policy needs to grant access to."
  value = [
    aws_dynamodb_table.farms.arn,
    aws_dynamodb_table.batches.arn,
    "${aws_dynamodb_table.batches.arn}/index/*",
    aws_dynamodb_table.users.arn,
    aws_dynamodb_table.mortality_logs.arn,
    aws_dynamodb_table.feed_logs.arn,
    aws_dynamodb_table.egg_logs.arn,
    aws_dynamodb_table.vaccination_records.arn,
    aws_dynamodb_table.vaccination_schedules.arn,
    "${aws_dynamodb_table.vaccination_schedules.arn}/index/*",
    aws_dynamodb_table.feed_purchases.arn,
    aws_dynamodb_table.weight_logs.arn,
    aws_dynamodb_table.sick_bay.arn,
    aws_dynamodb_table.suppressed_emails.arn,
    aws_dynamodb_table.push_subscriptions.arn,
    "${aws_dynamodb_table.push_subscriptions.arn}/index/*",
    aws_dynamodb_table.supplements.arn,
    aws_dynamodb_table.sales.arn,
    aws_dynamodb_table.medicine_purchases.arn,
  ]
}

output "suppressed_emails_table_arn" {
  description = "Broken out on its own (also present in table_arns above) for any future function that should read only the suppression list."
  value       = aws_dynamodb_table.suppressed_emails.arn
}
