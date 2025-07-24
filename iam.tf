resource "aws_iam_role" "lambda_role" {
  name               = "${var.prefix}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

data "aws_iam_policy_document" "dynamodb_policy" {
  statement {
    effect    = "Allow"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem"]
    resources = [aws_dynamodb_table.form_rate_limit.arn]
  }
}

resource "aws_iam_policy" "dynamodb_policy" {
  name   = "${var.prefix}-lambda-dynamodb-policy"
  policy = data.aws_iam_policy_document.dynamodb_policy.json
}

data "aws_iam_policy_document" "ses_policy" {
  statement {
    effect    = "Allow"
    actions   = ["ses:SendEmail"]
    resources = [var.iam_ses_identity_arn]
  }
}

resource "aws_iam_policy" "ses_policy" {
  name   = "${var.prefix}-lambda-ses-policy"
  policy = data.aws_iam_policy_document.ses_policy.json
}

data "aws_iam_policy_document" "cloudwatch_policy" {
  statement {
    effect  = "Allow"
    actions = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = [
      "${aws_cloudwatch_log_group.lambda_logs.arn}/*",
      aws_cloudwatch_log_group.lambda_logs.arn,
    ]
  }
}

resource "aws_iam_policy" "cloudwatch_policy" {
  name   = "${var.prefix}-lambda-cloudwatch-policy"
  policy = data.aws_iam_policy_document.cloudwatch_policy.json
}

resource "aws_iam_role_policy_attachment" "attach_dynamodb_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.dynamodb_policy.arn
}

resource "aws_iam_role_policy_attachment" "attach_ses_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.ses_policy.arn
}

resource "aws_iam_role_policy_attachment" "attach_cloudwatch_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.cloudwatch_policy.arn
}
