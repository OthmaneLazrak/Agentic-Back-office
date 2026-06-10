# ──────────────────────────────────────────────────────────────
#  KYC stack launcher — Architecture cible
#
#    Frontend
#       |
#    Spring Boot           (port 8000)
#       |
#    AI Orchestrator       (dans Spring, AiOrchestratorService HTTP)
#       |
#    Python Agent Server   (FastAPI, port 8500)
#       |
#    MCP Tools / Models    (SSE, port 7800, modèles chargés UNE fois)
#
#  Stratégie performance :
#    1. MCP server en mode SSE long-vivant -> modèles chargés UNE fois
#    2. KYC_MCP_PREWARM=1                  -> YOLO + TrOCR + Qwen-VL au boot
#    3. KYC_AGENT_REPORT_MODE=deterministic -> on évite Ollama (rapport
#       généré depuis le payload structuré, déjà localisé en français)
#    4. Python Agent Server résident       -> pas de spawn de process par requête
#
#  Usage :
#      ./start-kyc.ps1            # démarre la stack complète
#      ./start-kyc.ps1 -StopAll   # tue MCP + Agent + Spring lancés par le script
# ──────────────────────────────────────────────────────────────

param(
    [switch]$StopAll,
    [int]$McpPort = 7800,
    [int]$ChequeMcpPort = 7810,
    [int]$AgentPort = 8500,
    [string]$VlmDtype = "bf16",
    [switch]$NoCheque
)

$ErrorActionPreference = "Stop"
$RepoRoot   = $PSScriptRoot
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$McpServer       = Join-Path $RepoRoot "kyc_mcp_server\server.py"
$ChequeMcpServer = Join-Path $RepoRoot "cheque_mcp_server\server.py"
$AgentEntry = Join-Path $RepoRoot "api_server.py"
$SpringDir  = Join-Path $RepoRoot "kyc-spring-backend"
$PidFile    = Join-Path $RepoRoot ".kyc-stack.pids"

function Stop-Stack {
    if (-not (Test-Path $PidFile)) {
        Write-Host "Aucun PID enregistré." -ForegroundColor Yellow
        return
    }
    Get-Content $PidFile | ForEach-Object {
        $procId = [int]$_
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-Host "Process $procId arrêté." -ForegroundColor Green
        } catch {
            Write-Host "Process $procId déjà terminé." -ForegroundColor DarkGray
        }
    }
    Remove-Item $PidFile -Force
}

function Wait-Port {
    param([int]$Port, [int]$TimeoutSeconds = 180, [string]$Label = "service")
    Write-Host "    Attente du port $Port ($Label)..." -ForegroundColor DarkGray
    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        Start-Sleep -Seconds 1
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", $Port)
            $tcp.Close()
            return $true
        } catch { }
    }
    return $false
}

if ($StopAll) {
    Stop-Stack
    return
}

# Vérifications minimum
if (-not (Test-Path $VenvPython)) {
    throw "Python venv introuvable : $VenvPython"
}
if (-not (Test-Path $McpServer)) {
    throw "Serveur MCP introuvable : $McpServer"
}
if (-not (Test-Path $AgentEntry)) {
    throw "Python Agent Server introuvable : $AgentEntry"
}

# Test rapide GPU
$gpuCheck = & $VenvPython -c "import torch; print('CUDA' if torch.cuda.is_available() else 'CPU')" 2>$null
Write-Host ""
Write-Host "Hardware détecté : $gpuCheck" -ForegroundColor Cyan
Write-Host ""

# ────────────── 1. MCP server KYC (SSE) ──────────────
Write-Host "[1/4] Démarrage MCP server KYC (SSE, prewarm)..." -ForegroundColor Cyan

$env:KYC_MCP_TRANSPORT = "sse"
$env:KYC_MCP_PORT      = "$McpPort"
$env:KYC_MCP_PREWARM   = "1"
$env:KYC_VLM_DTYPE     = $VlmDtype
$env:PYTHONUNBUFFERED  = "1"

$mcpProc = Start-Process -FilePath $VenvPython `
    -ArgumentList "`"$McpServer`"", "--sse", "--port", "$McpPort", "--prewarm" `
    -WorkingDirectory (Split-Path $McpServer) `
    -WindowStyle Normal `
    -PassThru
Write-Host "    -> MCP PID = $($mcpProc.Id)" -ForegroundColor DarkGray
Set-Content -Path $PidFile -Value "$($mcpProc.Id)" -Encoding ascii

if (-not (Wait-Port -Port $McpPort -TimeoutSeconds 180 -Label "MCP SSE")) {
    throw "MCP server n'a pas ouvert le port $McpPort après 180s."
}
Write-Host "    OK — MCP KYC prêt sur http://127.0.0.1:$McpPort/sse" -ForegroundColor Green

# ────────────── 2. MCP server CHÈQUE (SSE, lazy) ──────────────
# GPU 6 Go : on ne peut PAS garder deux VLM résidents. Le serveur chèque démarre
# en SSE mais SANS prewarm -> 0 modèle en VRAM au boot. C'est l'agent orchestrateur
# qui charge/évince à la volée (un seul VLM chaud à la fois) : avant un chèque il
# libère le KYC, et inversement. Désactivable avec -NoCheque.
if (-not $NoCheque) {
    Write-Host ""
    Write-Host "[2/4] Démarrage MCP server CHÈQUE (SSE, lazy)..." -ForegroundColor Cyan

    $env:CHEQUE_MCP_TRANSPORT = "sse"
    $env:CHEQUE_MCP_PORT      = "$ChequeMcpPort"
    $env:CHEQUE_VLM_DTYPE     = $VlmDtype

    $chequeMcpProc = Start-Process -FilePath $VenvPython `
        -ArgumentList "`"$ChequeMcpServer`"", "--sse", "--port", "$ChequeMcpPort" `
        -WorkingDirectory (Split-Path $ChequeMcpServer) `
        -WindowStyle Normal `
        -PassThru
    Write-Host "    -> MCP Chèque PID = $($chequeMcpProc.Id)" -ForegroundColor DarkGray
    Add-Content -Path $PidFile -Value "$($chequeMcpProc.Id)" -Encoding ascii

    if (-not (Wait-Port -Port $ChequeMcpPort -TimeoutSeconds 180 -Label "MCP Chèque SSE")) {
        throw "MCP server chèque n'a pas ouvert le port $ChequeMcpPort après 180s."
    }
    Write-Host "    OK — MCP Chèque prêt sur http://127.0.0.1:$ChequeMcpPort/sse" -ForegroundColor Green
} else {
    Write-Host "[2/4] MCP server CHÈQUE ignoré (-NoCheque)." -ForegroundColor DarkGray
}

# ────────────── 3. Python Agent Server (FastAPI) ──────────────
Write-Host ""
Write-Host "[3/4] Démarrage Python Agent Server (FastAPI)..." -ForegroundColor Cyan

$env:KYC_MCP_TRANSPORT      = "sse"
$env:KYC_MCP_URL            = "http://127.0.0.1:$McpPort/sse"
$env:KYC_AGENT_REPORT_MODE  = "deterministic"
$env:KYC_AGENT_PYTHON       = $VenvPython
$env:KYC_AGENT_PORT         = "$AgentPort"
$env:KYC_AGENT_HOST         = "127.0.0.1"

# Agent CHÈQUE -> MCP chèque SSE (ou stdio en fallback si -NoCheque).
if (-not $NoCheque) {
    $env:CHEQUE_MCP_TRANSPORT     = "sse"
    $env:CHEQUE_MCP_URL           = "http://127.0.0.1:$ChequeMcpPort/sse"
} else {
    $env:CHEQUE_MCP_TRANSPORT     = ""
    $env:CHEQUE_MCP_URL           = ""
}
$env:CHEQUE_AGENT_REPORT_MODE = "deterministic"
$env:CHEQUE_AGENT_PYTHON      = $VenvPython

$AgentLog = Join-Path $RepoRoot "agent_server.log"
$agentProc = Start-Process -FilePath $VenvPython `
    -ArgumentList "`"$AgentEntry`"" `
    -WorkingDirectory $RepoRoot `
    -WindowStyle Normal `
    -RedirectStandardOutput $AgentLog `
    -RedirectStandardError "$AgentLog.err" `
    -PassThru
Write-Host "    -> Agent PID = $($agentProc.Id)" -ForegroundColor DarkGray
Write-Host "    -> Logs      = $AgentLog" -ForegroundColor DarkGray
Add-Content -Path $PidFile -Value "$($agentProc.Id)" -Encoding ascii

# Cold imports (torch + langchain + langgraph + langchain_mcp_adapters) can take
# 60-120s on first run. On garde la même tolérance que le MCP (180s).
if (-not (Wait-Port -Port $AgentPort -TimeoutSeconds 180 -Label "Python Agent")) {
    if ($agentProc.HasExited) {
        throw "Python Agent Server a crashé (exit $($agentProc.ExitCode)). Voir $AgentLog.err"
    }
    throw "Python Agent Server n'a pas ouvert le port $AgentPort après 180s. Voir $AgentLog"
}
Write-Host "    OK — Agent prêt sur http://127.0.0.1:$AgentPort" -ForegroundColor Green

# ────────────── 4. Spring backend ──────────────
Write-Host ""
Write-Host "[4/4] Démarrage Spring backend..." -ForegroundColor Cyan

$env:KYC_AGENT_URL              = "http://127.0.0.1:$AgentPort"
$env:KYC_AGENT_TIMEOUT_SECONDS  = "900"

Push-Location $SpringDir
try {
    & mvn spring-boot:run
} finally {
    Pop-Location
    Write-Host ""
    Write-Host "Spring arrêté — nettoyage MCP + Agent..." -ForegroundColor Yellow
    Stop-Stack
}
