resource "aws_dynamodb_table" "form_rate_limit" {
  name         = "${var.prefix}-rate-limit-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "key"

  attribute {
    name = "key"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}
