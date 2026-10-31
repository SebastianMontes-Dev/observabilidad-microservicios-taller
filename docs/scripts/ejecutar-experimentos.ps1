<#
  Ejecuta los experimentos de la guia (secciones 6 a 9) contra los dos microservicios
  y guarda las evidencias reales en docs/evidencias/script/.

  Requisitos: JDK 21 y puertos 8081/8082 libres. No requiere Docker.
  Uso:  powershell -ExecutionPolicy Bypass -File docs\scripts\ejecutar-experimentos.ps1
#>
$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ev = Join-Path $raiz 'docs\evidencias\script'
New-Item -ItemType Directory -Force -Path $ev | Out-Null
$tmp = Join-Path $env:TEMP 'obs-taller'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Empaquetar($modulo) {
  Push-Location (Join-Path $raiz $modulo)
  try { & .\mvnw.cmd -B -q -DskipTests package | Out-Null } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw "Fallo el empaquetado de $modulo" }
}

$script:logs = @{ 'microservicio-productos' = @(); 'microservicio-pedidos' = @() }

function Iniciar($modulo, $puerto, $logBase) {
  # Un archivo de log por arranque: Start-Process trunca el destino y se perderia la historia.
  $log = "$logBase.$($script:logs[$modulo].Count + 1)"
  $script:logs[$modulo] += $log
  $jar = Get-ChildItem (Join-Path $raiz "$modulo\target") -Filter '*.jar' |
         Where-Object { $_.Name -notlike '*.original' } | Select-Object -First 1
  $err = "$log.err"
  $p = Start-Process -FilePath 'java' -ArgumentList '-jar', $jar.FullName -PassThru -WindowStyle Hidden `
       -RedirectStandardOutput $log -RedirectStandardError $err
  for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-RestMethod "http://localhost:$puerto/actuator/health" | Out-Null; return $p } catch { Start-Sleep -Milliseconds 700 }
  }
  throw "$modulo no arranco en el puerto $puerto"
}

function Get-Texto($url) {
  try {
    $r = Invoke-WebRequest $url -UseBasicParsing
    if ($r.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($r.Content) } else { $r.Content }
  } catch {
    $resp = $_.Exception.Response
    if (-not $resp) { return $_.Exception.Message }
    $cuerpo = ''
    if ($resp.GetResponseStream) {
      $lector = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
      $cuerpo = $lector.ReadToEnd()
    }
    "HTTP $([int]$resp.StatusCode) $cuerpo"
  }
}

function Guardar($nombre, $texto) { [IO.File]::WriteAllText((Join-Path $ev $nombre), $texto, [Text.UTF8Encoding]::new($false)) }

# Indenta JSON compacto con 2 espacios (el ConvertTo-Json de PowerShell 5 deja huecos raros).
function Formato($json) {
  try { $compacto = $json | ConvertFrom-Json | ConvertTo-Json -Depth 10 -Compress } catch { return $json }
  $sb = New-Object Text.StringBuilder
  $nivel = 0; $enTexto = $false; $escape = $false
  foreach ($c in $compacto.ToCharArray()) {
    if ($enTexto) {
      [void]$sb.Append($c)
      if ($escape) { $escape = $false } elseif ($c -eq '') { $escape = $true } elseif ($c -eq '"') { $enTexto = $false }
      continue
    }
    switch ($c) {
      '"' { $enTexto = $true; [void]$sb.Append($c) }
      { $_ -eq '{' -or $_ -eq '[' } { $nivel++; [void]$sb.Append($c).Append("`n").Append(' ' * (2 * $nivel)) }
      { $_ -eq '}' -or $_ -eq ']' } { $nivel--; [void]$sb.Append("`n").Append(' ' * (2 * $nivel)).Append($c) }
      ',' { [void]$sb.Append($c).Append("`n").Append(' ' * (2 * $nivel)) }
      ':' { [void]$sb.Append(': ') }
      default { [void]$sb.Append($c) }
    }
  }
  $sb.ToString().Replace('{' + "`n" + (' ' * (2 * 1)) + '}', '{}')
}

Write-Output 'Empaquetando...'
Empaquetar 'microservicio-productos'
Empaquetar 'microservicio-pedidos'

$logProd = Join-Path $tmp 'productos.log'
$logPed = Join-Path $tmp 'pedidos.log'
$prod = Iniciar 'microservicio-productos' 8081 $logProd
$ped = Iniciar 'microservicio-pedidos' 8082 $logPed
try {
  # Seccion 4.3 y 6: respuestas JSON
  Guardar '01-productos-1.json' (Formato (Get-Texto 'http://localhost:8081/productos/1'))
  Guardar '02-pedidos-1.json' (Formato (Get-Texto 'http://localhost:8082/pedidos/1'))

  # Seccion 7: health de ambos
  Guardar '03-health-productos.json' (Formato (Get-Texto 'http://localhost:8081/actuator/health'))
  Guardar '04-health-pedidos.json' (Formato (Get-Texto 'http://localhost:8082/actuator/health'))
  Guardar '05-metrics-lista-pedidos.json' (Formato (Get-Texto 'http://localhost:8082/actuator/metrics'))

  # Seccion 8: Experimento 1. Reiniciamos pedidos para que "antes" sea tras UNA sola consulta.
  Stop-Process -Id $ped.Id -Force; Start-Sleep -Seconds 2
  Stop-Process -Id $prod.Id -Force; Start-Sleep -Seconds 2
  $prod = Iniciar 'microservicio-productos' 8081 $logProd
  $ped = Iniciar 'microservicio-pedidos' 8082 $logPed

  $uriPed = 'http://localhost:8082/actuator/metrics/http.server.requests?tag=uri:/pedidos/%7Bid%7D'
  $uriProd = 'http://localhost:8081/actuator/metrics/http.server.requests?tag=uri:/productos/%7Bid%7D'
  Get-Texto 'http://localhost:8082/pedidos/1' | Out-Null
  Guardar '06-metricas-pedidos-antes.json' (Formato (Get-Texto 'http://localhost:8082/actuator/metrics/http.server.requests'))
  Guardar '06b-metricas-pedidos-uri-antes.json' (Formato (Get-Texto $uriPed))
  Guardar '07-metricas-productos-antes.json' (Formato (Get-Texto 'http://localhost:8081/actuator/metrics/http.server.requests'))
  Guardar '07b-metricas-productos-uri-antes.json' (Formato (Get-Texto $uriProd))

  1..10 | ForEach-Object { Get-Texto 'http://localhost:8082/pedidos/1' | Out-Null }
  Guardar '08-metricas-pedidos-despues.json' (Formato (Get-Texto 'http://localhost:8082/actuator/metrics/http.server.requests'))
  Guardar '08b-metricas-pedidos-uri-despues.json' (Formato (Get-Texto $uriPed))
  Guardar '09-metricas-productos-despues.json' (Formato (Get-Texto 'http://localhost:8081/actuator/metrics/http.server.requests'))
  Guardar '09b-metricas-productos-uri-despues.json' (Formato (Get-Texto $uriProd))

  # Seccion 9: Experimento 2. Detener solo productos.
  Stop-Process -Id $prod.Id -Force; Start-Sleep -Seconds 2
  Guardar '10-pedidos-con-productos-caido.txt' (Get-Texto 'http://localhost:8082/pedidos/1')
  Guardar '11-health-pedidos-con-productos-caido.json' (Formato (Get-Texto 'http://localhost:8082/actuator/health'))
  Start-Sleep -Seconds 1

  # Reiniciar productos y comprobar la recuperacion
  $prod = Iniciar 'microservicio-productos' 8081 $logProd
  Guardar '12-pedidos-tras-reiniciar-productos.json' (Formato (Get-Texto 'http://localhost:8082/pedidos/1'))
  Start-Sleep -Seconds 1
}
finally {
  foreach ($p in @($prod, $ped)) { if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force } }
}

# Logs de consola (stdout + stderr de cada JVM) tal cual salieron
foreach ($modulo in $script:logs.Keys) {
  $salida = ''
  $n = 0
  foreach ($log in $script:logs[$modulo]) {
    $n++
    $salida += "===== Arranque $n de $modulo =====`r`n"
    $salida += (Get-Content $log -Raw -Encoding UTF8) + (Get-Content "$log.err" -Raw -Encoding UTF8) + "`r`n"
  }
  Guardar "consola-$($modulo -replace 'microservicio-','').txt" $salida
}
Write-Output "Evidencias guardadas en $ev"
