# Quick checks for staging nginx + dual API (run on API host).
param(
  [string]$BaseUrl = "http://127.0.0.1:8080"
)

$ErrorActionPreference = "Stop"
Write-Host "Health: $BaseUrl/health"
(Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing).Content
Write-Host "Health DB: $BaseUrl/health/db"
(Invoke-WebRequest -Uri "$BaseUrl/health/db" -UseBasicParsing).Content
Write-Host "OK"
