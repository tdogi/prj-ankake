variable "organization_id" {
  description = "Supabase organization slug that owns the Free-plan project."
  type        = string
  nullable    = false
}

variable "database_password" {
  description = "Initial password for the hosted Postgres database. Store it only in a local tfvars file or a secret manager."
  type        = string
  sensitive   = true
  nullable    = false

  validation {
    condition     = length(var.database_password) >= 16
    error_message = "database_password must be at least 16 characters long."
  }
}

variable "project_name" {
  description = "Name displayed for the Supabase project."
  type        = string
  default     = "project-ankake"
  nullable    = false
}

variable "region" {
  description = "Supabase region. This project is intentionally limited to Tokyo."
  type        = string
  default     = "ap-northeast-1"
  nullable    = false

  validation {
    condition     = var.region == "ap-northeast-1"
    error_message = "Only Tokyo (ap-northeast-1) is supported by this Free-plan configuration."
  }
}

variable "site_url" {
  description = "Canonical GitHub Pages URL used by Supabase Auth."
  type        = string
  default     = "https://tdogi.github.io/prj-ankake/"
  nullable    = false
}

variable "redirect_urls" {
  description = "URLs allowed as Supabase Auth redirect targets."
  type        = list(string)
  default     = ["https://tdogi.github.io/prj-ankake/"]
  nullable    = false
}
