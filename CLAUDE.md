# observabilidad-microservicios-taller

Laboratorio académico (Sistemas Distribuidos): dos microservicios Spring Boot que reproducen la guía "Observabilidad básica de microservicios con Spring Boot Actuator y Micrometer (sin Docker)". Entregables: código funcional + informe con evidencias.

## Regla principal: el código sigue la guía

`microservicio-productos` (:8081) y `microservicio-pedidos` (:8082) reproducen el código de la guía tal cual (Map como DTO, sin timeout ni manejo de errores **a propósito**: el experimento 2 depende de ello). No "mejorar" los controladores, `RestClientConfig` ni los `application.properties`. Lo único añadido son pruebas y `pruebas-observabilidad.http`.

## Stack y comandos

Java 21, Spring Boot **3.5.10** (Initializr ya solo ofrece 4.x; se generó con 4.x para tener el wrapper y se fijó el `pom.xml` a 3.5.10 con `spring-boot-starter-web`). Maven Wrapper por módulo, sin POM padre.

```bash
cd microservicio-productos && ./mvnw spring-boot:run   # :8081 (primero)
cd microservicio-pedidos && ./mvnw spring-boot:run     # :8082
./mvnw test                                            # en cada módulo
```

Trampas conocidas:
- En `@WebMvcTest` no existe `RestClient.Builder`; `PedidoControllerTest` lo construye a mano y lo liga a `MockRestServiceServer`. Con productos caído MockMvc **lanza** la excepción (no devuelve 500); en la app real Boot la convierte en 500.
- `spring-boot:run` y los lanzadores de IDE crean un JVM hijo: para liberar un puerto en Windows hay que terminar el proceso que escucha (`Get-NetTCPConnection -LocalPort <p>`).
- El agregado de `http.server.requests` incluye Actuator y `/favicon.ico` (404); para métricas de negocio filtrar con `?tag=uri:/pedidos/%7Bid%7D`.

## Documentación e informe

`docs/Informe-Taller-Observabilidad.docx|pdf` se **genera**, no se edita a mano (`docs/informe/generar-informe.js`). Lee el código real, `docs/evidencias/vscode/*.json` (tablas antes/después) y `docs/evidencias/capturas/*.png`. Los valores de la tabla agregada (sin filtrar) están transcritos en la constante `AGREGADO` del generador desde las capturas 06, 08, 09 y 11: si se regrapan las capturas hay que actualizarlos.

Las capturas y evidencias son de ejecuciones reales (VS Code + Edge, `docs/scripts/capturar-pantalla.ps1`; texto con `docs/scripts/ejecutar-experimentos.ps1`). No fabricarlas ni editarlas a mano; si se regraban, repetir la secuencia completa (el "antes" exige servicios recién arrancados y una sola consulta).

## Convenciones

Commits Conventional Commits en español, directo a `main`, sin `Co-Authored-By` de IA.
