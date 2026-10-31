<#
  Guarda en un PNG una captura real de UNA ventana (aunque otra ventana la tape) o de toda la pantalla.
  Uso:
    capturar-pantalla.ps1 -Salida docs\evidencias\capturas\01-x.png -Ventana 'observabilidad-microservicios-taller'
    capturar-pantalla.ps1 -Salida ...\02-y.png            # pantalla completa
  -Ventana: texto que debe contener el titulo de la ventana (proceso Code, Chrome, msedge, etc. en -Proceso).
#>
param(
  [Parameter(Mandatory)][string]$Salida,
  [string]$Ventana,
  [string]$Proceso = 'Code',
  [int]$AltoMax = 0   # recorta desde arriba a este alto (px); 0 = sin recorte
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
}
'@
[void][Win32]::SetProcessDPIAware()

$ruta = [IO.Path]::GetFullPath($Salida)
New-Item -ItemType Directory -Force -Path (Split-Path $ruta) | Out-Null

if ($Ventana) {
  $p = Get-Process -Name $Proceso -ErrorAction SilentlyContinue |
       Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$Ventana*" } | Select-Object -First 1
  if (-not $p) { throw "No hay ventana de '$Proceso' con titulo que contenga '$Ventana'" }
  $r = New-Object Win32+RECT
  [void][Win32]::GetWindowRect($p.MainWindowHandle, [ref]$r)
  $ancho = $r.Right - $r.Left; $alto = $r.Bottom - $r.Top
  $bmp = New-Object System.Drawing.Bitmap($ancho, $alto)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  [void][Win32]::PrintWindow($p.MainWindowHandle, $hdc, 2)   # 2 = PW_RENDERFULLCONTENT
  $g.ReleaseHdc($hdc); $g.Dispose()
} else {
  $pantalla = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap($pantalla.Width, $pantalla.Height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($pantalla.Location, [System.Drawing.Point]::Empty, $pantalla.Size)
  $g.Dispose()
}
if ($AltoMax -gt 0 -and $AltoMax -lt $bmp.Height) {
  $rec = $bmp.Clone((New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $AltoMax)), $bmp.PixelFormat)
  $bmp.Dispose(); $bmp = $rec
}
$bmp.Save($ruta, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "$ruta ($($bmp.Width)x$($bmp.Height))"
$bmp.Dispose()
