function Install-HarnessKit {
    param([string]$Version = '')

    $ErrorActionPreference = 'Stop'

    $releaseRepository = 'DengNaichen/harnesskit-releases'
    $releaseRepositoryUrl = "https://github.com/$releaseRepository"
    $target = 'x86_64-pc-windows-msvc'

    function Fail([string]$Message) {
        throw "harnesskit installer: $Message"
    }

    if (-not [Environment]::Is64BitOperatingSystem) {
        Fail 'unsupported platform: 32-bit Windows'
    }
    if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64') {
        Fail "unsupported platform: Windows/$($env:PROCESSOR_ARCHITECTURE)"
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    if (-not $Version) {
        $request = [Net.HttpWebRequest]::Create("$releaseRepositoryUrl/releases/latest")
        $request.AllowAutoRedirect = $false
        $response = $request.GetResponse()
        try {
            $location = $response.Headers['Location']
        } finally {
            $response.Close()
        }
        $prefix = "$releaseRepositoryUrl/releases/tag/harnesskit-v"
        if (-not $location -or -not $location.StartsWith($prefix)) {
            Fail 'latest release did not resolve to a InfHarness version'
        }
        $Version = $location.Substring($prefix.Length)
    }
    if ($Version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+$') {
        Fail 'version must be X.Y.Z'
    }

    $releaseTag = "harnesskit-v$Version"
    $archive = "$releaseTag-$target.zip"
    $downloadBase = "$releaseRepositoryUrl/releases/download/$releaseTag"
    $downloadDirectory = Join-Path ([IO.Path]::GetTempPath()) ("harnesskit-install." + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $downloadDirectory | Out-Null
    $installTemporary = $null

    try {
        $archivePath = Join-Path $downloadDirectory $archive
        $checksumPath = "$archivePath.sha256"
        Invoke-WebRequest -UseBasicParsing -Uri "$downloadBase/$archive" -OutFile $archivePath
        Invoke-WebRequest -UseBasicParsing -Uri "$downloadBase/$archive.sha256" -OutFile $checksumPath

        $checksumLines = @(Get-Content -LiteralPath $checksumPath)
        if ($checksumLines.Count -ne 1) { Fail 'checksum file has an invalid shape' }
        $fields = @($checksumLines[0] -split '\s+' | Where-Object { $_ })
        if ($fields.Count -ne 2) { Fail 'checksum file has an invalid shape' }
        $expectedChecksum = $fields[0]
        if ($expectedChecksum -cnotmatch '^[0-9a-f]{64}$') { Fail 'checksum is not lowercase SHA-256' }
        if ($fields[1] -ne $archive) { Fail 'checksum filename does not match the archive' }
        $actualChecksum = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualChecksum -ne $expectedChecksum) { Fail 'archive checksum mismatch' }

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $binaryPath = Join-Path $downloadDirectory 'harnesskit.exe'
        $zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
        try {
            if ($zip.Entries.Count -ne 1 -or $zip.Entries[0].FullName -ne 'harnesskit.exe') {
                Fail 'archive does not contain only harnesskit.exe'
            }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($zip.Entries[0], $binaryPath)
        } finally {
            $zip.Dispose()
        }

        $expectedVersion = "harnesskit $Version"
        try {
            $actualVersion = (& $binaryPath --version | Out-String).Trim()
        } catch {
            Fail 'downloaded harnesskit could not run'
        }
        if ($actualVersion -ne $expectedVersion) {
            Fail "downloaded harnesskit version does not match $Version"
        }

        if (-not $env:USERPROFILE) { Fail 'USERPROFILE is required' }
        $installDirectory = Join-Path $env:USERPROFILE '.local\bin'
        New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null
        $installTemporary = Join-Path $installDirectory ('.harnesskit.' + [Guid]::NewGuid().ToString('N') + '.tmp')
        Copy-Item -LiteralPath $binaryPath -Destination $installTemporary
        $installPath = Join-Path $installDirectory 'harnesskit.exe'
        try {
            Move-Item -LiteralPath $installTemporary -Destination $installPath -Force
        } catch {
            Fail "could not replace $installPath; close running harnesskit processes and retry"
        }
        $installTemporary = $null

        Write-Host "Installed $actualVersion to $installPath"
        $pathEntries = @($env:Path -split ';' | ForEach-Object { $_.TrimEnd('\') })
        if ($pathEntries -notcontains $installDirectory) {
            Write-Host "Add $installDirectory to PATH to run harnesskit directly."
        }
    } finally {
        if ($installTemporary -and (Test-Path -LiteralPath $installTemporary)) {
            Remove-Item -LiteralPath $installTemporary -Force
        }
        Remove-Item -LiteralPath $downloadDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Install-HarnessKit -Version $env:HARNESSKIT_VERSION
