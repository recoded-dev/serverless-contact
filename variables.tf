variable "from_email" {
  type        = string
  description = "iam_ses_identity_arn must be able to send from this email address."
}

variable "iam_ses_identity_arn" {
  type = string
}

variable "prefix" {
  type = string

  validation {
    condition     = can(regex("^[a-z-]+$", var.prefix))
    error_message = "prefix can only contain lowercase letters and dashes"
  }
}

variable "rate_limit_ttl" {
  type    = number
  default = 60
}

variable "recipient" {
  type = string
}

variable "turnstile_secret" {
  type      = string
  sensitive = true
}
