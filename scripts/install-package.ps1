param(
  [Parameter(Mandatory=$true)][string]$HarnessExe,
  [Parameter(Mandatory=$true)][string]$Profile,
  [Parameter(Mandatory=$true)][string]$Package,
  [string]$HarnessHome
)
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'PowerShell 7 is required'}
$exe=(Resolve-Path -LiteralPath $HarnessExe).Path
$archive=(Resolve-Path -LiteralPath $Package).Path
if([IO.Path]::GetExtension($archive) -ne '.tgz'){throw 'Expected an installable .tgz package'}
if($Profile -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]+$'){throw 'Invalid profile name'}
$cli=Join-Path (Split-Path $exe -Parent) 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'
$project=Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Path (Join-Path $project 'artifacts') -Force | Out-Null
$tag=[guid]::NewGuid().ToString('N')
$output=Join-Path $project "artifacts/install-$tag.stdout.log"
$errors=Join-Path $project "artifacts/install-$tag.stderr.log"
$previousNode=$env:ELECTRON_RUN_AS_NODE
$previousHome=$env:DSH_HOME
try {
  $env:ELECTRON_RUN_AS_NODE='1'
  if($HarnessHome){$env:DSH_HOME=[IO.Path]::GetFullPath($HarnessHome)}
  $arguments=@('--expose-internals',$cli,'plugin','--profile',$Profile,'add',$archive)
  $quoted=$arguments | ForEach-Object { '"'+($_ -replace '"','\"')+'"' }
  $process=Start-Process -FilePath $exe -ArgumentList $quoted -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $output -RedirectStandardError $errors
  Get-Content -LiteralPath $output
  Get-Content -LiteralPath $errors
  if($process.ExitCode -ne 0){throw "Official installer exited with $($process.ExitCode)"}
} finally {
  $env:ELECTRON_RUN_AS_NODE=$previousNode
  $env:DSH_HOME=$previousHome
}
