resource "aws_lambda_function" "form_handler" {
  function_name = "${var.prefix}-submit"
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_role.arn

  filename         = "${path.module}/lambda/dist.zip"
  source_code_hash = filesha256("${path.module}/lambda/dist.zip")

  # TODO figure out why logging isn't working
  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.lambda_logs.name
  }

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.form_rate_limit.name
      FROM_EMAIL          = var.from_email
      RATE_LIMIT_TTL      = var.rate_limit_ttl
      RECIPIENT           = var.recipient
      TURNSTILE_SECRET    = var.turnstile_secret
    }
  }
}

resource "aws_lambda_function_url" "form_handler" {
  function_name      = aws_lambda_function.form_handler.function_name
  authorization_type = "NONE"
}

output "form_handler_url" {
  value = aws_lambda_function_url.form_handler.function_url
}
