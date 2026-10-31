<#
  Abre el informe en Word, actualiza el indice (TOC) y guarda.
  Opcional: -Paginas <carpeta> exporta cada pagina como PNG para revisarla.
  Siempre exporta tambien el PDF junto al .docx (para subirlo a la plataforma).
  Requiere Microsoft Word instalado (Windows).
#>
param(
  [string]$Docx = (Join-Path $PSScriptRoot '..\Informe-Taller-Observabilidad.docx'),
  [string]$Paginas
)

$Docx = (Resolve-Path $Docx).Path
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($Docx)
  $doc.ActiveWindow.View.Type = 3   # vista de impresion
  $doc.Repaginate()
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  $doc.Fields.Update() | Out-Null
  $doc.Repaginate()
  $total = $doc.ComputeStatistics(2)   # wdStatisticPages
  Write-Output "Paginas: $total"

  if ($Paginas) {
    Add-Type -AssemblyName System.Drawing
    New-Item -ItemType Directory -Force -Path $Paginas | Out-Null
    $pane = $doc.ActiveWindow.ActivePane
    for ($i = 1; $i -le $total; $i++) {
      $bytes = $pane.Pages.Item($i).EnhMetaFileBits
      $ms = New-Object System.IO.MemoryStream(,$bytes)
      $img = [System.Drawing.Image]::FromStream($ms)
      $escala = 1000.0 / $img.Width
      $bmp = New-Object System.Drawing.Bitmap([int]1000, [int]($img.Height * $escala))
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.Clear([System.Drawing.Color]::White)
      $g.InterpolationMode = 'HighQualityBicubic'
      $g.DrawImage($img, 0, 0, $bmp.Width, $bmp.Height)
      $g.Dispose()
      $bmp.Save((Join-Path $Paginas ('pagina-{0:D2}.png' -f $i)), [System.Drawing.Imaging.ImageFormat]::Png)
      $bmp.Dispose(); $img.Dispose(); $ms.Dispose()
    }
    Write-Output "PNG por pagina en: $Paginas"
  }
  $doc.Save()
  $pdf = [IO.Path]::ChangeExtension($Docx, '.pdf')
  $doc.ExportAsFixedFormat($pdf, 17)   # 17 = wdExportFormatPDF
  Write-Output "PDF: $pdf"
  $doc.Close($false)
} finally {
  $word.Quit()
}
