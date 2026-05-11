param(
  [string]$ProjectRef = "dzfbjscrpxhpyeimggut",
  [string]$DbPassword = $env:SUPABASE_DB_PASSWORD,
  [switch]$IncludePagBank
)

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  throw "Defina SUPABASE_ACCESS_TOKEN antes de rodar este script. Ex: `$env:SUPABASE_ACCESS_TOKEN = 'seu-token'"
}

$functions = @(
  "create-first-admin",
  "generate-tryon",
  "replicate-webhook",
  "health-check",
  "create-kiosk-payment",
  "create-delivery-link",
  "manage-admin-users",
  "redeem-kiosk-install-code",
  "report-kiosk-health",
  "poll-kiosk-commands"
)

if ($IncludePagBank) {
  $functions += "pagbank-webhook"
}

Write-Host "Aplicando migrations no projeto $ProjectRef..."
if ($DbPassword) {
  npx supabase link --project-ref $ProjectRef --password $DbPassword
  npx supabase db push --password $DbPassword --linked
} else {
  Write-Host "SUPABASE_DB_PASSWORD nao definido. Usando projeto ja linkado e solicitacao interativa do CLI se necessario."
  npx supabase link --project-ref $ProjectRef
  npx supabase db push --linked
}

foreach ($fn in $functions) {
  Write-Host "Publicando function $fn..."
  npx supabase functions deploy $fn --project-ref $ProjectRef
}

Write-Host ""
Write-Host "Deploy concluido."
Write-Host "Configure secrets no painel Supabase:"
Write-Host "- REPLICATE_API_TOKEN"
Write-Host "- KIOSK_SIMULATE_PAYMENTS=true apenas para laboratorio"
if ($IncludePagBank) {
  Write-Host "- PAGBANK_API_TOKEN"
  Write-Host "- PAGBANK_API_BASE"
  Write-Host "- PAGBANK_NOTIFICATION_URL"
} else {
  Write-Host "PagBank ficou de fora. Rode com -IncludePagBank quando a API for liberada."
}
