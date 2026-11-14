param(
    [switch]$PublishWhenValidated,
    [int]$TimeoutMinutes = 20,
    [string]$Version = '0.1.1',
    [string]$DeploymentId
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$bundlePath = Join-Path $PSScriptRoot "collabora-engine-$Version-central-bundle.zip"
$settingsPath = Join-Path $HOME '.m2\settings.xml'
$apiRoot = 'https://central.sonatype.com/api/v1/publisher'

if ([string]::IsNullOrWhiteSpace($DeploymentId) -and !(Test-Path -LiteralPath $bundlePath)) { throw ('Missing signed bundle: {0}' -f $bundlePath) }
if (!(Test-Path -LiteralPath $settingsPath)) { throw ('Missing Maven user settings: {0}' -f $settingsPath) }

[xml]$settings = Get-Content -LiteralPath $settingsPath -Raw
$server = $settings.SelectSingleNode("/*[local-name()='settings']/*[local-name()='servers']/*[local-name()='server'][*[local-name()='id']='central']")
if ($null -eq $server -or [string]::IsNullOrWhiteSpace($server.username) -or [string]::IsNullOrWhiteSpace($server.password)) {
    throw ('Configure the Sonatype User Token in the central server entry in {0}; do not put it in the repository or chat.' -f $settingsPath)
}

$tokenInput = [string]$server.username + ':' + [string]$server.password
$basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($tokenInput))
$tokenInput = $null
$handler = [System.Net.Http.HttpClientHandler]::new()
$proxyAddress = if (![string]::IsNullOrWhiteSpace($env:HTTPS_PROXY)) { $env:HTTPS_PROXY } else { $env:HTTP_PROXY }
if (![string]::IsNullOrWhiteSpace($proxyAddress)) {
    $handler.Proxy = [System.Net.WebProxy]::new([Uri]$proxyAddress)
    $handler.UseProxy = $true
    $handler.DefaultProxyCredentials = [System.Net.CredentialCache]::DefaultCredentials
}
$client = [System.Net.Http.HttpClient]::new($handler)
$client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $basic)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36')
$client.Timeout = [TimeSpan]::FromMinutes(30)

if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
    $fileStream = [System.IO.File]::OpenRead($bundlePath)
    try {
        $multipart = [System.Net.Http.MultipartFormDataContent]::new()
        $fileContent = [System.Net.Http.StreamContent]::new($fileStream)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/octet-stream')
        $multipart.Add($fileContent, 'bundle', [IO.Path]::GetFileName($bundlePath))
        $uploadUri = '{0}/upload?name=Collabora%20Mobile%20Engine%20{1}&publishingType=USER_MANAGED' -f $apiRoot, [Uri]::EscapeDataString($Version)
        $uploadResponse = $client.PostAsync($uploadUri, $multipart).GetAwaiter().GetResult()
        $uploadBody = $uploadResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if (!$uploadResponse.IsSuccessStatusCode) { throw ('Central upload failed (HTTP {0}): {1}' -f [int]$uploadResponse.StatusCode, $uploadBody) }
        $deploymentId = $uploadBody.Trim().Trim([char]34)
        Write-Output ('Central deployment: {0}' -f $deploymentId)
    }
    finally {
        if ($null -ne $multipart) { $multipart.Dispose() }
        $fileStream.Dispose()
    }
} else {
    Write-Output ('Resuming Central deployment: {0}' -f $DeploymentId)
}

$deadline = [DateTime]::UtcNow.AddMinutes($TimeoutMinutes)
do {
    Start-Sleep -Seconds 15
    $escapedDeploymentId = [Uri]::EscapeDataString([string]$deploymentId)
    $statusUri = '{0}/status?id={1}' -f $apiRoot, $escapedDeploymentId
    $statusContent = [System.Net.Http.ByteArrayContent]::new([byte[]]@())
    $statusResponse = $client.PostAsync($statusUri, $statusContent).GetAwaiter().GetResult()
    $statusContent.Dispose()
    $statusBody = $statusResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if (!$statusResponse.IsSuccessStatusCode) { throw ('Central status request failed (HTTP {0}): {1}' -f [int]$statusResponse.StatusCode, $statusBody) }
    $status = $statusBody | ConvertFrom-Json
    Write-Output ('Central state: {0}' -f $status.deploymentState)
    if ($status.deploymentState -eq 'FAILED') { throw ('Central validation failed: {0}' -f ($status.errors | ConvertTo-Json -Depth 8 -Compress)) }
    if ($status.deploymentState -eq 'VALIDATED') {
        if (!$PublishWhenValidated) { Write-Output 'Validation passed; publishing is disabled by switch.'; break }
        $publishUri = '{0}/deployment/{1}' -f $apiRoot, $escapedDeploymentId
        $publishContent = [System.Net.Http.ByteArrayContent]::new([byte[]]@())
        $publishResponse = $client.PostAsync($publishUri, $publishContent).GetAwaiter().GetResult()
        $publishContent.Dispose()
        if (!$publishResponse.IsSuccessStatusCode) {
            $publishBody = $publishResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            throw ('Central publish request failed (HTTP {0}): {1}' -f [int]$publishResponse.StatusCode, $publishBody)
        }
    }
    if ($status.deploymentState -eq 'PUBLISHED') { break }
} while ([DateTime]::UtcNow -lt $deadline)

if ([DateTime]::UtcNow -ge $deadline) { throw ('Timed out after {0} minutes; deployment id: {1}' -f $TimeoutMinutes, $deploymentId) }
$client.Dispose()
