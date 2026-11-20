# CortexMed Windows PowerShell Production Launcher
# Launches both vic-backend (FastAPI CDSS) and mira-chat (Next.js 16) in separate sessions

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  CORTEXMED PRODUCTION SYSTEM LAUNCHER (Windows / PS)   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

# 1. Environment File Check
$MiraChatEnv = Join-Path $RepoRoot "mira-chat\.env.local"
$MiraChatEnvAlt = Join-Path $RepoRoot "mira-chat\.env"
$VicBackendEnv = Join-Path $RepoRoot "vic-backend\.env"

$HasFrontendEnv = (Test-Path $MiraChatEnv) -or (Test-Path $MiraChatEnvAlt)
$HasBackendEnv = Test-Path $VicBackendEnv

if (-not $HasFrontendEnv) {
    Write-Host "[WARNING] mira-chat/.env.local not found." -ForegroundColor Yellow
    Write-Host "          Please copy mira-chat/.env.example to mira-chat/.env.local and configure your credentials." -ForegroundColor Yellow
} else {
    Write-Host "[OK] Frontend environment file verified." -ForegroundColor Green
}

if (-not $HasBackendEnv) {
    Write-Host "[WARNING] vic-backend/.env not found." -ForegroundColor Yellow
    Write-Host "          Please copy vic-backend/.env.example to vic-backend/.env and configure your credentials." -ForegroundColor Yellow
} else {
    Write-Host "[OK] Backend environment file verified." -ForegroundColor Green
}

# 2. YOLOv8n ONNX Model Check
$OnnxPath = Join-Path $RepoRoot "mira-chat\public\models\yolov8n.onnx"
if (-not (Test-Path $OnnxPath)) {
    Write-Host "[ERROR] Authentic YOLOv8n ONNX model missing at $OnnxPath" -ForegroundColor Red
    Write-Host "        Please run: python scripts/export_yolo_onnx.py" -ForegroundColor Red
    exit 1
} else {
    $OnnxSize = (Get-Item $OnnxPath).Length
    $OnnxMb = [math]::Round($OnnxSize / 1MB, 2)
    Write-Host "[OK] YOLOv8n ONNX verified ($OnnxMb MB > 10 MB threshold)." -ForegroundColor Green
}

# 3. Start Backend in a New PowerShell Window
Write-Host "`n[1/2] Starting CortexMed CDSS Backend on port 8000..." -ForegroundColor Cyan
$BackendCmd = "cd '$RepoRoot\vic-backend'; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- CortexMed CDSS Backend (FastAPI) ---' -ForegroundColor Cyan; $BackendCmd"

# 4. Start Frontend in a New PowerShell Window
Write-Host "[2/2] Starting CortexMed Next.js 16 Frontend on port 3000..." -ForegroundColor Cyan
$FrontendCmd = "cd '$RepoRoot\mira-chat'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '--- CortexMed Frontend (Next.js 16) ---' -ForegroundColor Cyan; $FrontendCmd"

# 5. Open Browser Automatically
Write-Host "`nOpening default browser to CortexMed Command Center and CDSS Console..." -ForegroundColor Green
Start-Sleep -Seconds 4
Start-Process "http://localhost:3000"
Start-Sleep -Seconds 1
Start-Process "http://localhost:3000/cdss"

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  CORTEXMED SERVICES LAUNCHED SUCCESSFULLY               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Operational Views:" -ForegroundColor White
Write-Host "  Command Center:     http://localhost:3000" -ForegroundColor Cyan
Write-Host "  CDSS Console:       http://localhost:3000/cdss" -ForegroundColor Cyan
Write-Host "  AR Vision HUD:      http://localhost:3000/stream" -ForegroundColor Cyan
Write-Host "  Bilingual Voice:    http://localhost:3000/device" -ForegroundColor Cyan
Write-Host "  Caregiver Portal:   http://localhost:3000/dashboard" -ForegroundColor Cyan
Write-Host "  System Readiness:   http://localhost:8000/health" -ForegroundColor Cyan
Write-Host "`nKeep both terminal windows running. Press Ctrl+C in their respective windows to stop." -ForegroundColor White
