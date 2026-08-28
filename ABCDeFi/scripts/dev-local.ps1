[CmdletBinding()]
param(
  [ValidateRange(30, 300)]
  [int]$HealthTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$rpcUrl = 'http://127.0.0.1:8545'
$childPowerShell = Join-Path $PSHOME 'powershell.exe'

if (-not (Test-Path -LiteralPath $childPowerShell)) {
  $childPowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
}

function Assert-PortIsFree {
  param([int]$Port, [string]$ServiceName)

  $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($listener) {
    throw "$ServiceName cannot start: port $Port is already owned by PID $($listener.OwningProcess). Stop that process first; this script never attaches to an unknown runtime."
  }
}

function Assert-NoIndexerProcess {
  $existing = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match 'backend:indexer|runLendingIndexer|franchise-indexer|runFranchiseIndexer'
  } | Select-Object -First 1
  if ($existing) {
    throw "Lending indexer cannot start: an existing indexer process was found (PID $($existing.ProcessId)). Stop it first; this script never starts a competing indexer."
  }
}

function Wait-Until {
  param([string]$Description, [scriptblock]$Probe)

  $deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
  $lastError = $null
  while ((Get-Date) -lt $deadline) {
    try {
      & $Probe
      return
    } catch {
      $lastError = $_.Exception.Message
      Start-Sleep -Seconds 1
    }
  }
  throw "Timed out waiting for $Description. Last error: $lastError"
}

function Start-ServiceTerminal {
  param([string]$Name, [string]$Command)

  $commandLine = "& { Set-Location -LiteralPath '$projectRoot'; $Command }"
  Start-Process -FilePath $childPowerShell -ArgumentList @('-NoExit', '-Command', $commandLine) -WorkingDirectory $projectRoot -WindowStyle Normal -PassThru |
    Out-Null
  Write-Host "Started $Name."
}

function Invoke-LocalRpc {
  param([string]$Method, [object[]]$Params = @())

  $body = @{ jsonrpc = '2.0'; method = $Method; params = $Params; id = 1 } |
    ConvertTo-Json -Compress
  Invoke-RestMethod -Uri $rpcUrl -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 5
}

Assert-PortIsFree -Port 8545 -ServiceName 'Hardhat'
Assert-PortIsFree -Port 5000 -ServiceName 'Backend'
Assert-PortIsFree -Port 5173 -ServiceName 'Vite'
Assert-NoIndexerProcess

Start-ServiceTerminal -Name 'Hardhat Local (31337)' -Command 'npx hardhat node --network hardhatMainnet'
Wait-Until -Description 'Hardhat RPC at 127.0.0.1:8545' -Probe {
  $chain = Invoke-LocalRpc -Method 'eth_chainId'
  if ($chain.result -ne '0x7a69') { throw "Hardhat RPC returned unexpected chain ID $($chain.result)" }
}

Push-Location $projectRoot
try {
  & npm.cmd run deploy:local
  if ($LASTEXITCODE -ne 0) { throw "Canonical deployment failed with exit code $LASTEXITCODE." }

  & npx.cmd hardhat run scripts/verify-phase1-deployment.ts --network localhost
  if ($LASTEXITCODE -ne 0) { throw "Canonical deployment verification failed with exit code $LASTEXITCODE." }
} finally {
  Pop-Location
}

Start-ServiceTerminal -Name 'ABCDeFi backend (OTP terminal)' -Command 'npm run backend'
Wait-Until -Description 'backend health endpoint' -Probe {
  $null = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/api/lending/status' -UseBasicParsing -TimeoutSec 5
}

Start-ServiceTerminal -Name 'ABCDeFi lending indexer' -Command 'npm run backend:indexer'
Start-ServiceTerminal -Name 'ABCDeFi Franchise indexer' -Command 'npm run backend:franchise-indexer'
Start-ServiceTerminal -Name 'ABCDeFi Vite frontend' -Command 'npm run dev'
Wait-Until -Description 'Vite frontend' -Probe {
  $null = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 5
}
Wait-Until -Description 'confirmed canonical lending indexer synchronization' -Probe {
  $status = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/lending/status' -TimeoutSec 5
  if ($status.status -ne 'AVAILABLE' -or -not $status.available) {
    throw "Indexer reports $($status.status): $($status.reason)"
  }
}
Wait-Until -Description 'confirmed canonical Franchise indexer synchronization' -Probe {
  $status = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/franchise/status' -TimeoutSec 5
  if ($status.status -ne 'AVAILABLE' -or -not $status.available) {
    throw "Franchise indexer reports $($status.status): $($status.reason)"
  }
}

$block = Invoke-LocalRpc -Method 'eth_blockNumber'
Write-Host ''
Write-Host 'ABCDeFi local runtime is ready.'
Write-Host '  RPC:      http://127.0.0.1:8545 (31337)'
Write-Host "  Block:    $($block.result)"
Write-Host '  Backend:  http://127.0.0.1:5000'
Write-Host '  Frontend: http://localhost:5173'
Write-Host '  Lending:  AVAILABLE / canonical-indexed-on-chain'
