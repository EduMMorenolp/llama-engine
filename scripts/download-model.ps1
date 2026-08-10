<#
  Descarga un modelo GGUF desde Hugging Face a ./models con la convencion del proyecto.
  Convencion: models/<id>.gguf (+ opcional models/mmproj-<id>.gguf para vision).
  Catalogo:
    qwen3.5-4b (default) -> ggml-org/Qwen3-4B-GGUF : Qwen3-4B-Q4_K_M.gguf
  Uso:
    .\scripts\download-model.ps1                                   (default: qwen3.5-4b)
    .\scripts\download-model.ps1 -Quant Q8_0
    .\scripts\download-model.ps1 -Repo user/repo -File Model.gguf -Id mi-id
#>
[CmdletBinding()]
param(
  [string]$Model = "qwen3.5-4b",
  [string]$Repo = "",
  [string]$File = "",
  [string]$Id = "",
  [string]$Quant = "Q4_K_M",
  [switch]$Mmproj,
  [string]$ModelsDir = "./models",
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$HfBase = "https://huggingface.co"

# --- catalogo ---
$Catalog = @{
  "qwen3.5-4b" = @{ repo = "ggml-org/Qwen3-4B-GGUF"; file = "Qwen3-4B-$Quant.gguf" }
}

if (-not $Repo) {
  if (-not $Catalog.ContainsKey($Model)) {
    Write-Error "Modelo '$Model' no esta en el catalogo. Usa -Repo y -File explicitos."
    exit 1
  }
  $Repo = $Catalog[$Model].repo
  $File = $Catalog[$Model].file
  if (-not $Id) { $Id = $Model }
}
if (-not $Id) { $Id = $Model }

New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null
$Target = Join-Path $ModelsDir "$Id.gguf"
$Url = "$HfBase/$Repo/resolve/main/$File"

Write-Host "==> Descargando modelo" -ForegroundColor Cyan
Write-Host "    id      : $Id"
Write-Host "    repo    : $Repo"
Write-Host "    archivo : $File"
Write-Host "    destino : $Target"

if ((Test-Path $Target) -and ((Get-Item $Target).Length -gt 0) -and -not $Force) {
  Write-Host "INFO: Ya existe $Target. Usa -Force para sobrescribir." -ForegroundColor Yellow
  return
}

Write-Host "    url     : $Url"
try {
  Invoke-WebRequest -Uri $Url -OutFile $Target -UseBasicParsing
  Write-Host "OK: Modelo descargado: $Target" -ForegroundColor Green
} catch {
  Write-Error "FALLO la descarga: $($_.Exception.Message)"
  Remove-Item $Target -Force -ErrorAction SilentlyContinue
  exit 1
}

if ($Mmproj) {
  $MmUrl = "$HfBase/$Repo/resolve/main/mmproj-$File"
  $MmTarget = Join-Path $ModelsDir "mmproj-$Id.gguf"
  if ((Test-Path $MmTarget) -and ((Get-Item $MmTarget).Length -gt 0) -and -not $Force) {
    Write-Host "INFO: Ya existe $MmTarget." -ForegroundColor Yellow
  } else {
    try {
      Invoke-WebRequest -Uri $MmUrl -OutFile $MmTarget -UseBasicParsing
      Write-Host "OK: mmproj (vision) descargado: $MmTarget" -ForegroundColor Green
    } catch {
      Write-Host "AVISO: No se pudo descargar mmproj para $Repo (es multimodal?)." -ForegroundColor Yellow
      Remove-Item $MmTarget -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host ""
Write-Host "Listo. Reinicia el runtime para que tome el modelo:" -ForegroundColor White
Write-Host "    docker compose restart llama-runtime"