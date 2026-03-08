$pagesDir = "c:\Users\Paul\hack-tech\frontend\src\pages"
$compDir = "c:\Users\Paul\hack-tech\frontend\src\components"
$files = Get-ChildItem -Path $pagesDir, $compDir -Recurse -Filter *.jsx

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    $content = $content -replace '\[#1e3a8a\]//', '[#1e3a8a]/'
    $content = $content -replace '\[#1e3a8a\]/50/(\d+)', '[#1e3a8a]/$1'
    $content = $content -replace 'hover:bg-\[#1e3a8a\] border', 'hover:bg-[#1e3a8a]/20 border'

    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
}
Write-Output "Done cleaning up"
