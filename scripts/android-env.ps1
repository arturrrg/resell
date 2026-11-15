$resellCargoBin = Join-Path $env:USERPROFILE '.cargo/bin'
foreach ($resellName in @('JAVA_HOME', 'ANDROID_HOME', 'NDK_HOME')) {
    $resellValue = [Environment]::GetEnvironmentVariable($resellName, 'User')
    if ($resellValue) { Set-Item -Path "Env:$resellName" -Value $resellValue }
}
$resellPathParts = @($resellCargoBin)
if ($env:JAVA_HOME) { $resellPathParts += Join-Path $env:JAVA_HOME 'bin' }
if ($env:ANDROID_HOME) { $resellPathParts += Join-Path $env:ANDROID_HOME 'platform-tools' }
$env:PATH = ($resellPathParts -join ';') + ';' + $env:PATH
