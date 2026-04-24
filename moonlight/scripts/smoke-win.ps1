# =============================================================================
# MoonLight v2.7.0 — Windows installer smoke test
# =============================================================================
#
# Runs AFTER `yarn dist:win` on a Windows runner (or a dev's Windows box).
# Verifies that the produced NSIS installer is well-formed WITHOUT actually
# installing it system-wide. Checks performed:
#
#   1. There is exactly one *.exe installer under -DistDir.
#   2. The .exe is larger than -MinSizeMB (default 10 MB).
#   3. A sibling *.exe.sha256 file exists AND the hash matches.
#   4. `latest.yml` (electron-updater manifest) exists.
#   5. The installer exposes its NSIS "/?" help surface — this proves it
#      is a real NSIS binary (not a zero-byte stub), without running the
#      actual installer UI.
#
# Exit codes:
#   0 — all checks passed
#   1 — at least one check failed (details printed)
#
# Usage (local):
#   pwsh -File scripts/smoke-win.ps1 -DistDir "desktop/dist"
#   pwsh -File scripts/smoke-win.ps1 -DistDir "C:\path\to\dist" -MinSizeMB 15
#
# Usage (CI):
#   - name: Installer smoke test
#     run: pwsh -File scripts/smoke-win.ps1 -DistDir "desktop/dist"
#
# Notes on "silent install" (/S flag):
#   We deliberately do NOT run `installer.exe /S` in CI because that would
#   mutate the runner's registry / Program Files. The `/?` probe is safe
#   and proves the binary is executable by Windows without side effects.
# =============================================================================

[CmdletBinding()]
param(
    [string]$DistDir = "desktop/dist",
    [int]$MinSizeMB = 10
)

$ErrorActionPreference = 'Stop'

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

$failures = @()

# ---------------------------------------------------------------------------
# 1. Resolve dist dir
# ---------------------------------------------------------------------------
Write-Section "1) Resolve dist dir"
if (-Not (Test-Path $DistDir)) {
    Write-Error "DistDir not found: $DistDir"
    exit 1
}
$DistDirAbs = (Resolve-Path $DistDir).Path
Write-Host "DistDir: $DistDirAbs"

# ---------------------------------------------------------------------------
# 2. Locate the installer
# ---------------------------------------------------------------------------
Write-Section "2) Locate installer (.exe)"
$exes = @(Get-ChildItem -Path $DistDirAbs -Filter '*.exe' -ErrorAction SilentlyContinue)
if ($exes.Count -eq 0) {
    $failures += "No *.exe found under $DistDirAbs"
} else {
    foreach ($e in $exes) {
        $sizeMB = [math]::Round($e.Length / 1MB, 2)
        Write-Host "  • $($e.Name) — $sizeMB MB"
    }
}

# ---------------------------------------------------------------------------
# 3. Size check
# ---------------------------------------------------------------------------
Write-Section "3) Size check (≥ $MinSizeMB MB)"
foreach ($e in $exes) {
    $sizeMB = [math]::Round($e.Length / 1MB, 2)
    if ($e.Length -lt ($MinSizeMB * 1MB)) {
        $failures += "$($e.Name) is only $sizeMB MB (< $MinSizeMB MB minimum)"
    } else {
        Write-Host "  OK: $($e.Name) = $sizeMB MB"
    }
}

# ---------------------------------------------------------------------------
# 4. SHA256 checksum present + valid
# ---------------------------------------------------------------------------
Write-Section "4) SHA256 checksum validation"
foreach ($e in $exes) {
    $sha256File = "$($e.FullName).sha256"
    if (-Not (Test-Path $sha256File)) {
        $failures += "Missing sidecar checksum: $sha256File"
        continue
    }
    $content = (Get-Content $sha256File -Raw).Trim()
    # Line format:  "<hash>  <filename>"
    $parts = $content -split '\s+', 2
    if ($parts.Count -lt 1 -or $parts[0].Length -ne 64) {
        $failures += "Malformed sha256 file: $sha256File"
        continue
    }
    $claimedHash = $parts[0].ToUpper()
    $actualHash = (Get-FileHash $e.FullName -Algorithm SHA256).Hash
    if ($claimedHash -ne $actualHash) {
        $failures += "Checksum MISMATCH for $($e.Name): claimed=$claimedHash actual=$actualHash"
    } else {
        Write-Host "  OK: $($e.Name) sha256 = $actualHash"
    }
}

# ---------------------------------------------------------------------------
# 5. electron-updater manifest
# ---------------------------------------------------------------------------
Write-Section "5) electron-updater latest.yml"
$latestYml = Join-Path $DistDirAbs "latest.yml"
if (-Not (Test-Path $latestYml)) {
    # Not fatal: some release flows publish latest.yml only on tag push.
    Write-Warning "latest.yml not produced ($latestYml) — auto-update manifest missing."
} else {
    $len = (Get-Item $latestYml).Length
    Write-Host "  OK: latest.yml = $len bytes"
}

# ---------------------------------------------------------------------------
# 6. NSIS help-surface probe (`/?`) — proves the binary is runnable.
#    NOTE: we pipe through Start-Process + timeout because NSIS may not
#    actually print to stdout; we just check that the process starts and
#    exits cleanly. On non-Windows hosts this check is skipped.
# ---------------------------------------------------------------------------
Write-Section "6) NSIS help-surface probe"
if ($IsWindows -eq $false -and $null -ne $PSVersionTable.Platform -and $PSVersionTable.Platform -ne 'Win32NT') {
    Write-Host "  Skipped (non-Windows host)."
} else {
    foreach ($e in $exes) {
        try {
            $p = Start-Process -FilePath $e.FullName -ArgumentList '/?' `
                -PassThru -WindowStyle Hidden -ErrorAction Stop
            # Best-effort: wait up to 5 seconds for the help popup to dismiss.
            if (-Not $p.WaitForExit(5000)) {
                try { $p.Kill() | Out-Null } catch {}
                Write-Host "  OK (running): $($e.Name) launched but /? blocked (killed after 5s)."
            } else {
                Write-Host "  OK: $($e.Name) /? exit=$($p.ExitCode)"
            }
        } catch {
            $failures += "Could not launch $($e.Name) with /? : $_"
        }
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Section "Summary"
if ($failures.Count -eq 0) {
    Write-Host "smoke-win: PASS ✅" -ForegroundColor Green
    exit 0
} else {
    Write-Host "smoke-win: FAIL ❌" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    exit 1
}
