resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "${var.prefix}-lambda-logs"
  retention_in_days = 7
}
