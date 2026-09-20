# Authentication is supplied through the SUPABASE_ACCESS_TOKEN environment
# variable. Do not place a management token in this repository.
provider "supabase" {}

# A Free-plan organization provisions its included Nano compute instance when
# instance_size is omitted. Do not add paid compute or other paid add-ons here.
resource "supabase_project" "ankake" {
  organization_id   = var.organization_id
  name              = var.project_name
  database_password = var.database_password
  region            = var.region

  lifecycle {
    # The management API does not return the database password. Keeping the
    # initial value in local state avoids a perpetual diff after project setup.
    ignore_changes = [database_password]
  }
}

resource "supabase_settings" "ankake" {
  project_ref = supabase_project.ankake.id

  auth = jsonencode({
    site_url                        = var.site_url
    uri_allow_list                  = join(",", var.redirect_urls)
    external_anonymous_users_enabled = true
  })
}

data "supabase_apikeys" "ankake" {
  project_ref = supabase_project.ankake.id
}
