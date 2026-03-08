$pagesDir = "c:\Users\Paul\hack-tech\frontend\src\pages"
$compDir = "c:\Users\Paul\hack-tech\frontend\src\components"

$files = Get-ChildItem -Path $pagesDir, $compDir -Recurse -Filter *.jsx

foreach ($file in $files) {
    # Read content
    $content = Get-Content $file.FullName -Raw

    # We only want to replace inside className="..." or className={`...`}
    # Since doing regex with lookaheads in PS is tricky for arbitrary lengths,
    # let's just do global replace. It's safe enough for Tailwind classes if we are careful.

    # Backgrounds
    $content = $content -replace 'bg-\[#0b1120\](/\d+)?', 'bg-slate-50'
    $content = $content -replace 'bg-slate-800(/\d+)?', 'bg-white'
    $content = $content -replace 'bg-slate-900(/\d+)?', 'bg-white'
    $content = $content -replace 'bg-slate-700(/\d+)?', 'bg-slate-100'
    $content = $content -replace 'bg-black', 'bg-slate-900'

    # Borders
    $content = $content -replace 'border-slate-700(/\d+)?', 'border-slate-200'
    $content = $content -replace 'border-slate-800', 'border-slate-200'
    $content = $content -replace 'border-slate-600(/\d+)?', 'border-slate-300'
    $content = $content -replace 'border-\[#0b1120\]', 'border-white'

    # Brand colors
    $content = $content -replace 'bg-blue-600(/\d+)?', 'bg-[#1e3a8a]'
    $content = $content -replace 'hover:bg-blue-500', 'hover:bg-[#1e3a8a]/90'
    $content = $content -replace 'bg-blue-500(/\d+)', 'bg-[#1e3a8a]/$1'
    $content = $content -replace 'bg-blue-500(?!\/)', 'bg-[#1e3a8a]'
    
    $content = $content -replace 'text-blue-400', 'text-[#1e3a8a]'
    $content = $content -replace 'text-blue-500', 'text-[#1e3a8a]'
    $content = $content -replace 'border-blue-400', 'border-[#1e3a8a]'
    $content = $content -replace 'border-blue-500(/50)?', 'border-[#1e3a8a]/50'
    $content = $content -replace 'ring-blue-500(/30)?', 'ring-[#1e3a8a]/30'
    $content = $content -replace 'shadow-blue-600', 'shadow-blue-900'

    # Texts
    # Careful: text-white -> text-slate-900 globally WILL break buttons.
    # Instead, let's fix buttons after.
    $content = $content -replace 'text-white', 'text-slate-900'
    $content = $content -replace 'text-slate-400', 'text-slate-500'
    $content = $content -replace 'text-slate-300', 'text-slate-500'
    
    # Text-slate-500 was originally light text, now it gets mapped.
    # We leave text-slate-500 as is or map it. The string matched text-slate-400 -> text-slate-500.

    # Re-fix buttons and primary elements
    # bg-[#1e3a8a] text-slate-900 -> text-white
    $content = $content -replace 'bg-\[#1e3a8a\]([^>]*?)text-slate-900', 'bg-[#1e3a8a]$1text-white'
    $content = $content -replace 'text-slate-900([^>]*?)bg-\[#1e3a8a\]', 'text-white$1bg-[#1e3a8a]'
    
    # Same for green/red badges which had text-white originally? Actually they had explicit colors e.g. text-green-400
    # Let's fix text-slate-900 back to text-white if inside specific colorful bgs
    # The login button has hover:bg-[#1e3a8a]/90.
    
    Set-Content -Path $file.FullName -Value $content -Encoding UTF8
}
Write-Output "Done applying skin"
