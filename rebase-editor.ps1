$file = $args[0]
$content = Get-Content $file
$newContent = @()

foreach ($line in $content) {
    if ($line -match '^(pick|drop|edit|reword|squash|fixup|exec|break|label|reset|merge)') {
        if ($line -match '61871b5|4ac098f|1162846|5c9adc9|cc5f885') {
            # Drop these commits
            $newContent += $line -replace '^pick', 'drop'
        } else {
            # Keep other commits
            $newContent += $line
        }
    } else {
        $newContent += $line
    }
}

Set-Content -Path $file -Value $newContent

