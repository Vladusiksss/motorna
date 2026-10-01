# Run from PowerShell: .\Start-Local.ps1
$ErrorActionPreference='Stop'
$projectPath=$PSScriptRoot
$partsIndexKeyPath=Join-Path $projectPath '.parts-index-key'
if(Test-Path -LiteralPath $partsIndexKeyPath){$env:PARTS_INDEX_API_KEY=(Get-Content -LiteralPath $partsIndexKeyPath -Raw).Trim()}
$workspacePath=Split-Path (Split-Path $projectPath -Parent) -Parent
$dataPath=Join-Path $workspacePath 'work/mvs'
$runtimePath=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies'
$pythonPath=Join-Path $runtimePath 'python/python.exe'
$nodePath=Join-Path $runtimePath 'node/bin/node.exe'
$pgBin=Join-Path $dataPath 'postgres/pgsql/bin'
& (Join-Path $pgBin 'pg_isready.exe') -h 127.0.0.1 -p 55432 -U motorna | Out-Null
if($LASTEXITCODE -ne 0){
 & (Join-Path $pgBin 'pg_ctl.exe') -D (Join-Path $dataPath 'pgdata') -l (Join-Path $dataPath 'postgres.log') -o '-p 55432 -h 127.0.0.1' start
 if($LASTEXITCODE -ne 0){throw 'Не вдалося запустити PostgreSQL'}
}
$env:PYTHONPATH=Join-Path $dataPath 'python-packages'
$env:MVS_AUTO_UPDATE='1'
$env:AI_API_URL='http://127.0.0.1:8010/v1/chat/completions'
$env:AI_MODEL='motorna-local'
try {$aiReady=(Invoke-WebRequest 'http://127.0.0.1:8010/health' -TimeoutSec 3).StatusCode -eq 200} catch {$aiReady=$false}
if(!$aiReady){
 $modelPath=Join-Path $dataPath 'model.gguf'
 $aiExe=Join-Path $dataPath 'llama-static/llama-server.exe'
 Start-Process -FilePath $aiExe -ArgumentList @('--model',('"'+$modelPath+'"'),'--alias','motorna-local','--host','127.0.0.1','--port','8010','--ctx-size','3072','--threads','4','--parallel','1','--n-predict','600') -WorkingDirectory $dataPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataPath 'ai.out.log') -RedirectStandardError (Join-Path $dataPath 'ai.err.log') | Out-Null
}
$env:MVS_API_URL='http://127.0.0.1:8008'
$env:Path=(Split-Path $nodePath -Parent)+';'+$env:Path
try { $backendReady=(Invoke-WebRequest 'http://127.0.0.1:8008/health' -TimeoutSec 3).StatusCode -eq 200 } catch { $backendReady=$false }
if(!$backendReady){
 Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','main:app','--host','127.0.0.1','--port','8008') -WorkingDirectory (Join-Path $projectPath 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataPath 'backend.out.log') -RedirectStandardError (Join-Path $dataPath 'backend.err.log') | Out-Null
}
try {$webReady=(Invoke-WebRequest 'http://localhost:5173/' -TimeoutSec 3).StatusCode -eq 200} catch {$webReady=$false}
if(!$webReady){
 $lockPath=Join-Path $projectPath '.vinext/dev/lock.json'
 if(Test-Path -LiteralPath $lockPath){
  $devLock=Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
  $lockOwner=Get-Process -Id $devLock.pid -ErrorAction SilentlyContinue
  # Windows can reuse a stopped server's PID for an unrelated process.
  if(!$lockOwner -or $lockOwner.ProcessName -ne 'node'){
   Remove-Item -LiteralPath $lockPath
  }
 }
 Start-Process -FilePath $nodePath -ArgumentList @('scripts/run-framework.mjs','dev') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataPath 'web.out.log') -RedirectStandardError (Join-Path $dataPath 'web.err.log') | Out-Null
}
for($attempt=0;$attempt -lt 15 -and !$webReady;$attempt++){
 try {$webReady=(Invoke-WebRequest 'http://localhost:5173/' -TimeoutSec 3).StatusCode -eq 200} catch {Start-Sleep -Seconds 1}
}
if(!$webReady){throw ('Сайт не запустився. Перевірте журнал: '+(Join-Path $dataPath 'web.err.log'))}
Write-Output 'МОТОРНА: http://localhost:5173/ — автооновлення МВС активне, поки сервер працює.'

