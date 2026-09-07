param([Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
$taskDirectory = (Resolve-Path -LiteralPath $Directory).Path
$taskOutput = Join-Path $taskDirectory 'office-preview'
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$wordExisted = [bool](Get-Process WINWORD -ErrorAction SilentlyContinue)
$powerPointExisted = [bool](Get-Process POWERPNT -ErrorAction SilentlyContinue)
$wordApp = $null
$powerPointApp = $null
try {
  $documents = @(Get-ChildItem -LiteralPath $taskDirectory -Filter '*.docx')
  if ($documents.Count -gt 0) {
    $wordApp = New-Object -ComObject Word.Application
    $wordApp.DisplayAlerts = 0
    $wordApp.AutomationSecurity = 3
    foreach ($file in $documents) {
      $openedDocument = $wordApp.Documents.Open($file.FullName, $false, $true, $false)
      try {
        $openedDocument.Repaginate()
        $pageCount = $openedDocument.ComputeStatistics(2)
        $pdfPath = Join-Path $taskOutput ($file.BaseName + '.pdf')
        $openedDocument.ExportAsFixedFormat($pdfPath, 17)
        Write-Output ('WORD OPENED: ' + $file.Name + ' | actual pages: ' + $pageCount)
      } finally { $openedDocument.Close(0) }
    }
  }
  $presentations = @(Get-ChildItem -LiteralPath $taskDirectory -Filter '*.pptx')
  if ($presentations.Count -gt 0) {
    $powerPointApp = New-Object -ComObject PowerPoint.Application
    $powerPointApp.AutomationSecurity = 3
    foreach ($file in $presentations) {
      $openedDeck = $powerPointApp.Presentations.Open($file.FullName, -1, 0, 0)
      try {
        $deckOutput = Join-Path $taskOutput $file.BaseName
        New-Item -ItemType Directory -Path $deckOutput -Force | Out-Null
        $openedDeck.Export($deckOutput, 'PNG', 1280, 720)
        Write-Output ('POWERPOINT OPENED: ' + $file.Name + ' | actual slides: ' + $openedDeck.Slides.Count)
      } finally { $openedDeck.Close() }
    }
  }
} finally {
  if ($wordApp -and -not $wordExisted) { $wordApp.Quit() }
  if ($powerPointApp -and -not $powerPointExisted) { $powerPointApp.Quit() }
}
