# Builds the Windows installer on the Windows side (Windows Node can't work on a \\wsl$ path,
# and the WSL node_modules has Linux binaries). Copies the repo, installs, builds.
param(
  [string]$Source = "\\wsl.localhost\Ubuntu\home\clarisfanhere\Practices\personal-projects\drpk",
  [string]$Dest = "$env:LOCALAPPDATA\drpk-build"
)
$ErrorActionPreference = "Stop"

robocopy $Source $Dest /MIR /XD node_modules .next .git dist dist-electron .data /XF ".env*" /NFL /NDL /NJH /NJS /NP
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

# /MIR skips dist, so old installers would pile up; start each build empty.
foreach ($dir in "dist", "dist-electron") {
  $path = Join-Path $Dest $dir
  if (Test-Path -LiteralPath $path) {
    try {
      Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
    } catch {
      throw "Could not clear $path - close drpk or wait for the antivirus scan, then retry. $_"
    }
  }
}

Push-Location $Dest
try {
  corepack yarn install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "yarn install failed" }
  corepack yarn dist
  if ($LASTEXITCODE -ne 0) { throw "yarn dist failed" }
  Write-Host "Installer written to $Dest\dist"
} finally {
  Pop-Location
}
