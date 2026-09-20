output "project_ref" {
  description = "Project reference used by the Supabase CLI."
  value       = supabase_project.ankake.id
}

output "project_url" {
  description = "Base URL of the hosted Supabase project."
  value       = "https://${supabase_project.ankake.id}.supabase.co"
}

output "publishable_key" {
  description = "Publishable API key for the browser build. It is safe to expose to the client, but is marked sensitive to avoid accidental terminal output."
  value       = data.supabase_apikeys.ankake.publishable_key
  sensitive   = true
}
