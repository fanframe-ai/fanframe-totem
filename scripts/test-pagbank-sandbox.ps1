param(
  [string]$Token = $env:PAGBANK_API_TOKEN,
  [string]$BaseUrl = "https://sandbox.api.pagseguro.com",
  [string]$NotificationUrl = "https://dzfbjscrpxhpyeimggut.supabase.co/functions/v1/pagbank-webhook",
  [int]$AmountCents = 1000,
  [switch]$SkipCards
)

$ErrorActionPreference = "Stop"

if (-not $Token) {
  throw "Defina PAGBANK_API_TOKEN com uma chave sandbox antes de rodar. Ex: `$env:PAGBANK_API_TOKEN = 'seu-token-sandbox'"
}

$BaseUrl = $BaseUrl.TrimEnd("/")

$headers = @{
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json"
  Accept = "application/json"
}

function Invoke-PagBankJson {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body
  )

  $jsonBody = $null
  if ($null -ne $Body) {
    $jsonBody = $Body | ConvertTo-Json -Depth 20
  }

  try {
    $response = Invoke-WebRequest -Uri "$BaseUrl$Path" -Method $Method -Headers $headers -Body $jsonBody -UseBasicParsing
    return @{
      statusCode = [int]$response.StatusCode
      body = $response.Content | ConvertFrom-Json
    }
  } catch {
    $response = $_.Exception.Response
    if (-not $response) { throw }
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    $content = $reader.ReadToEnd()
    return @{
      statusCode = [int]$response.StatusCode
      body = if ($content) { $content | ConvertFrom-Json } else { $null }
    }
  }
}

function New-Customer {
  return @{
    name = "Cliente FanFrame Sandbox"
    email = "sandbox@fanframe.local"
    tax_id = "12345678909"
    phones = @(
      @{
        country = "55"
        area = "11"
        number = "999999999"
        type = "MOBILE"
      }
    )
  }
}

function New-CardChargeBody {
  param(
    [string]$ReferenceId,
    [string]$CardNumber,
    [string]$SecurityCode,
    [string]$ExpMonth,
    [string]$ExpYear
  )

  return @{
    reference_id = $ReferenceId
    description = "FanFrame sandbox card test"
    amount = @{
      value = $AmountCents
      currency = "BRL"
    }
    payment_method = @{
      type = "CREDIT_CARD"
      installments = 1
      capture = $false
      card = @{
        number = $CardNumber
        exp_month = $ExpMonth
        exp_year = $ExpYear
        security_code = $SecurityCode
        holder = @{
          name = "Jose da Silva"
        }
      }
    }
  }
}

$results = New-Object System.Collections.Generic.List[object]

$pixReference = "fanframe-pix-" + [guid]::NewGuid().ToString("N")
$pixBody = @{
  reference_id = $pixReference
  customer = New-Customer
  items = @(
    @{
      reference_id = $pixReference
      name = "FanFrame Totem Sandbox"
      quantity = 1
      unit_amount = $AmountCents
    }
  )
  qr_codes = @(
    @{
      amount = @{ value = $AmountCents }
      expiration_date = (Get-Date).AddMinutes(10).ToString("yyyy-MM-ddTHH:mm:sszzz")
    }
  )
  notification_urls = @($NotificationUrl)
}

$pix = Invoke-PagBankJson -Method "POST" -Path "/orders" -Body $pixBody
$pixOk = ($pix.statusCode -eq 200 -or $pix.statusCode -eq 201) -and $pix.body.id -and $pix.body.qr_codes
$results.Add([pscustomobject]@{
  test = "PIX order"
  expected = "order with qr_codes"
  statusCode = $pix.statusCode
  pagbankStatus = $pix.body.status
  id = $pix.body.id
  passed = [bool]$pixOk
})

if (-not $SkipCards) {
  $cards = @(
    @{ label = "visa_autorizada"; number = "4539620659922097"; cvv = "123"; month = "12"; year = "2030"; expected = @("AUTHORIZED", "PAID") },
    @{ label = "master_autorizada"; number = "5240082975622454"; cvv = "123"; month = "12"; year = "2030"; expected = @("AUTHORIZED", "PAID") },
    @{ label = "amex_autorizada"; number = "345817690311361"; cvv = "123"; month = "12"; year = "2030"; expected = @("AUTHORIZED", "PAID") },
    @{ label = "elo_autorizada"; number = "4514161122113757"; cvv = "123"; month = "12"; year = "2030"; expected = @("AUTHORIZED", "PAID") },
    @{ label = "visa_negada"; number = "4929291898380766"; cvv = "123"; month = "12"; year = "2030"; expected = @("DECLINED") },
    @{ label = "master_negada"; number = "5530062640663264"; cvv = "123"; month = "12"; year = "2030"; expected = @("DECLINED") },
    @{ label = "amex_negada"; number = "372938001199778"; cvv = "123"; month = "12"; year = "2030"; expected = @("DECLINED") },
    @{ label = "elo_negada"; number = "4389350446134811"; cvv = "123"; month = "12"; year = "2030"; expected = @("DECLINED") }
  )

  foreach ($card in $cards) {
    $reference = "fanframe-card-" + $card.label + "-" + [guid]::NewGuid().ToString("N")
    $charge = Invoke-PagBankJson -Method "POST" -Path "/charges" -Body (New-CardChargeBody `
      -ReferenceId $reference `
      -CardNumber $card.number `
      -SecurityCode $card.cvv `
      -ExpMonth $card.month `
      -ExpYear $card.year)

    $chargeStatus = [string]$charge.body.status
    $results.Add([pscustomobject]@{
      test = $card.label
      expected = ($card.expected -join " or ")
      statusCode = $charge.statusCode
      pagbankStatus = $chargeStatus
      id = $charge.body.id
      passed = [bool]($charge.statusCode -eq 200 -or $charge.statusCode -eq 201) -and $card.expected.Contains($chargeStatus)
    })
  }
}

$results | Format-Table -AutoSize

$failed = @($results | Where-Object { -not $_.passed })
if ($failed.Count -gt 0) {
  throw "$($failed.Count) teste(s) PagBank sandbox falharam."
}

Write-Host "Todos os testes PagBank sandbox passaram."
