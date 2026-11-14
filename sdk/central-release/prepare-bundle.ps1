param(
    [Parameter(Mandatory = $true)]
    [string]$SigningKeyId,
    [string]$Version = '0.1.1'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$artifactId = 'collabora-engine'
$version = $Version
$groupId = 'io.github.tmkmk.collabora'
$relativeArtifactPath = Join-Path 'io\github\tmkmk\collabora\collabora-engine' $version
$stageRoot = Join-Path $PSScriptRoot "staging-$version"
$artifactDir = Join-Path $stageRoot $relativeArtifactPath
$aarSource = Join-Path $repoRoot "sdk\collabora-engine\build\repo\org\libreoffice\collabora-engine\$version-poc\collabora-engine-$version-poc.aar"
$aarTarget = Join-Path $artifactDir "$artifactId-$version.aar"
$pomPath = Join-Path $artifactDir "$artifactId-$version.pom"
$bundlePath = Join-Path $PSScriptRoot "$artifactId-$version-central-bundle.zip"
$gpg = Join-Path $env:ProgramFiles 'GnuPG\bin\gpg.exe'

if (!(Test-Path -LiteralPath $aarSource)) { throw "完整 Engine AAR 不存在：$aarSource" }
if (!(Test-Path -LiteralPath $gpg)) { throw "未找到 GPG：$gpg" }
if (!(Test-Path -LiteralPath $artifactDir)) { New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null }

$pom = @'
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>io.github.tmkmk.collabora</groupId>
  <artifactId>collabora-engine</artifactId>
  <version>__VERSION__</version>
  <packaging>aar</packaging>
  <name>Collabora Mobile Engine</name>
  <description>Collabora Office Android Engine AAR for native Android, uni-app, and uni-app x integration.</description>
  <url>https://github.com/tmkmk/CollaboraUniAppXMavenPoC</url>
  <licenses>
    <license>
      <name>Mozilla Public License Version 2.0</name>
      <url>https://www.mozilla.org/en-US/MPL/2.0/</url>
      <distribution>repo</distribution>
      <comments>The AAR also contains third-party components under additional licenses. See assets/license.html and assets/notice.txt inside the AAR.</comments>
    </license>
  </licenses>
  <developers>
    <developer>
      <name>Mac Xiang</name>
      <url>https://github.com/tmkmk</url>
    </developer>
  </developers>
  <scm>
    <connection>scm:git:https://github.com/tmkmk/CollaboraUniAppXMavenPoC.git</connection>
    <developerConnection>scm:git:ssh://git@github.com/tmkmk/CollaboraUniAppXMavenPoC.git</developerConnection>
    <url>https://github.com/tmkmk/CollaboraUniAppXMavenPoC</url>
  </scm>
  <dependencies>
    <dependency>
      <groupId>androidx.appcompat</groupId>
      <artifactId>appcompat</artifactId>
      <version>1.7.1</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>com.google.android.material</groupId>
      <artifactId>material</artifactId>
      <version>1.13.0</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.constraintlayout</groupId>
      <artifactId>constraintlayout</artifactId>
      <version>2.2.1</version>
      <scope>compile</scope>
    </dependency>
  </dependencies>
</project>
'@
$pom = $pom.Replace('__VERSION__', $version)

[System.IO.File]::WriteAllText($pomPath, $pom, [System.Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath $aarSource -Destination $aarTarget -Force

$aarMetadata = Join-Path $artifactDir '.aar-metadata'
New-Item -ItemType Directory -Path $aarMetadata -Force | Out-Null
$metadataFiles = @(
    (Join-Path $aarMetadata 'README.md'),
    (Join-Path $aarMetadata 'LICENSE-NOTICE.md')
)
[System.IO.File]::WriteAllText($metadataFiles[0], @'
This classifier artifact is a Central-required placeholder because the upstream Engine AAR does not include Java/Kotlin source code or generated Javadoc.

The distributed binary is the Collabora Office Android engine. Its source and build instructions are maintained by the upstream Collabora Online project: https://github.com/CollaboraOnline/online.mirror

The exact third-party license notices are embedded in the main AAR at `assets/license.html` and `assets/notice.txt`.
'@, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($metadataFiles[1], @'
The Engine AAR declares Mozilla Public License 2.0 as its primary license. The AAR also contains third-party components under additional licenses. Consult `assets/license.html` and `assets/notice.txt` in the main AAR for the full notices and terms.
'@, [System.Text.UTF8Encoding]::new($false))

foreach ($classifier in @('sources', 'javadoc')) {
    $jarPath = Join-Path $artifactDir "$artifactId-$version-$classifier.jar"
    if (Test-Path -LiteralPath $jarPath) { Remove-Item -LiteralPath $jarPath -Force }
    & jar.exe --create --file $jarPath -C $aarMetadata .
    if ($LASTEXITCODE -ne 0) { throw "生成 $classifier 占位 JAR 失败" }
}
Remove-Item -LiteralPath $aarMetadata -Recurse -Force

$files = Get-ChildItem -LiteralPath $artifactDir -File | Where-Object { $_.Extension -ne '.asc' -and $_.Name -notlike '*.md5' -and $_.Name -notlike '*.sha1' -and $_.Name -notlike '*.sha256' -and $_.Name -notlike '*.sha512' }
foreach ($file in $files) {
    foreach ($algorithm in @('MD5', 'SHA1', 'SHA256', 'SHA512')) {
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm $algorithm).Hash.ToLowerInvariant()
        [System.IO.File]::WriteAllText("$($file.FullName).$($algorithm.ToLowerInvariant())", $hash, [System.Text.Encoding]::ASCII)
    }
    & $gpg --batch --yes --armor --detach-sign --local-user $SigningKeyId --output "$($file.FullName).asc" $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "GPG 签名失败：$($file.Name)" }
}

if (Test-Path -LiteralPath $bundlePath) { Remove-Item -LiteralPath $bundlePath -Force }
Compress-Archive -Path (Join-Path $stageRoot '*') -DestinationPath $bundlePath -CompressionLevel Optimal
Write-Output "Central bundle: $bundlePath"
Write-Output "Bundle bytes: $((Get-Item -LiteralPath $bundlePath).Length)"
