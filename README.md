# Observabilidad básica de microservicios con Spring Boot Actuator y Micrometer

Laboratorio de **Sistemas Distribuidos** (práctica guiada, sin Docker): dos microservicios REST independientes, sus endpoints de Actuator, las métricas HTTP de Micrometer, los logs de negocio y el efecto de que una dependencia remota deje de estar disponible.

[![CI](https://github.com/SebastianMontes-Dev/observabilidad-microservicios-taller/actions/workflows/ci.yml/badge.svg)](https://github.com/SebastianMontes-Dev/observabilidad-microservicios-taller/actions/workflows/ci.yml)

```
Cliente HTTP ──▶ microservicio-pedidos (8082) ──▶ microservicio-productos (8081)
                  /actuator/health, /metrics        /actuator/health, /metrics
```

| Módulo | Puerto | Endpoint de negocio |
|---|---|---|
| `microservicio-productos` | 8081 | `GET /productos/{id}` |
| `microservicio-pedidos` | 8082 | `GET /pedidos/{id}` (llama a productos con `RestClient`) |

## Requisitos

- JDK 21 (`java -version`)
- Puertos 8081 y 8082 libres
- Internet solo la primera vez, para descargar dependencias Maven
- No se necesita Maven instalado: cada módulo trae su Maven Wrapper. No se usa Docker, MySQL, Prometheus ni Grafana.

Stack: Java 21, Spring Boot **3.5.10**, Spring Web, Spring Boot Actuator.

## Ejecutar

Cada módulo es un proyecto Maven independiente (sin POM padre). **Primero productos, después pedidos**, cada uno en su terminal:

```bash
cd microservicio-productos && ./mvnw spring-boot:run     # :8081
```

```bash
cd microservicio-pedidos && ./mvnw spring-boot:run       # :8082
```

En Windows usa `mvnw.cmd`. También se pueden abrir en IntelliJ IDEA o VS Code (Spring Boot Dashboard) y ejecutar las clases `MicroservicioProductosApplication` y `MicroservicioPedidosApplication`.

## Probar

```bash
curl http://localhost:8081/productos/1
curl http://localhost:8082/pedidos/1
curl http://localhost:8081/actuator/health
curl http://localhost:8082/actuator/health
curl http://localhost:8082/actuator/metrics
curl http://localhost:8082/actuator/metrics/http.server.requests
curl "http://localhost:8082/actuator/metrics/http.server.requests?tag=uri:/pedidos/%7Bid%7D"
```

`microservicio-pedidos/pruebas-observabilidad.http` trae las mismas peticiones para el cliente HTTP de IntelliJ o la extensión REST Client de VS Code.

Pruebas automáticas (en cada módulo): `./mvnw test`.

## Experimentos

1. **Métricas de solicitudes.** Consulta `/pedidos/1`, anota `COUNT`, `TOTAL_TIME` y `MAX` de `http.server.requests`, haz 10 consultas más y compara. Filtra por URI para no mezclar Actuator con el negocio.
2. **Fallo de dependencia.** Detén solo `microservicio-productos` y consulta `/pedidos/1`: HTTP 500 y excepción en la consola de pedidos. `/actuator/health` de pedidos **sigue en `UP`** porque el health predeterminado no comprueba el servicio remoto. Reinicia productos y pedidos se recupera.

Resultados reales y su interpretación: [`docs/Informe-Taller-Observabilidad.pdf`](docs/Informe-Taller-Observabilidad.pdf) (también en `.docx`).

## Estructura

```
microservicio-productos/    # Spring Boot, :8081
microservicio-pedidos/      # Spring Boot, :8082 (incluye pruebas-observabilidad.http)
docs/
  Informe-Taller-Observabilidad.docx | .pdf   # informe con evidencias, tablas y respuestas
  evidencias/
    capturas/               # 15 capturas reales (VS Code y Edge)
    vscode/                 # JSON de métricas de la ejecución desde VS Code
    script/                 # salidas y logs de la ejecución automatizada
  scripts/
    ejecutar-experimentos.ps1   # repite los experimentos y regraba docs/evidencias/script
    capturar-pantalla.ps1       # captura de una ventana a PNG
  informe/                  # generador del informe (Node + docx)
```

## Regenerar el informe

Requiere Node y Microsoft Word (Windows). Lee el código, las evidencias y las capturas; si falta una captura deja un recuadro rojo, nunca inventa evidencia.

```powershell
cd docs\informe
npm install
npm run generar
.\actualizar-indice.ps1      # actualiza el índice en Word y exporta el PDF
```

## Notas y limitaciones

- Configuración **académica y local**. En producción: restringir los endpoints de administración, no mostrar detalles de salud públicamente, definir timeouts, instrumentar dependencias y centralizar la recolección.
- Se usa `Map` como representación de datos para simplificar, igual que la guía. En un proyecto real: DTO tipados, validación, timeout y manejo de errores.
- Ampliación posible: Prometheus, Grafana y Micrometer Tracing con Zipkin como procesos independientes.
