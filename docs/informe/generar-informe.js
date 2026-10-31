// Genera docs/Informe-Taller-Observabilidad.docx a partir de lo que hay en el repo:
// código real, respuestas y logs de docs/evidencias, y capturas de docs/evidencias/capturas.
// Uso (una vez): npm install   |   Generar: npm run generar
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, AlignmentType, ImageRun, Footer, PageNumber, LevelFormat,
  TableOfContents, PageBreak, VerticalAlign,
} = require('docx');

const RAIZ = path.resolve(__dirname, '..', '..');
const EVID = path.join(RAIZ, 'docs', 'evidencias');
const CAPTURAS = path.join(EVID, 'capturas');
const SALIDA = path.join(RAIZ, 'docs', 'Informe-Taller-Observabilidad.docx');

const AUTOR = 'Sebastian Montes Olivera';
const FECHA = '31 de octubre de 2026';
const REPO_URL = process.env.REPO_URL || 'https://github.com/SebastianMontes-Dev/observabilidad-microservicios-taller';

const AZUL = '1F3864';
const GRIS_BORDE = 'BFBFBF';
const GRIS_CODIGO = 'F2F2F2';
const ANCHO = 9026; // A4 con márgenes de 1"

// ---------- lectura de evidencias ----------
const leer = (...p) => fs.readFileSync(path.join(...p), 'utf8').replace(/\r/g, '').replace(/^﻿/, '');
const codigo = (rel) => leer(RAIZ, rel).replace(/\n+$/, '').split('\n');
const json = (...p) => JSON.parse(leer(...p));
const metrica = (archivo) => {
  const m = json(EVID, 'vscode', archivo).measurements;
  const por = Object.fromEntries(m.map((x) => [x.statistic, x.value]));
  return { count: por.COUNT, total: por.TOTAL_TIME, max: por.MAX };
};
const s3 = (n) => n.toFixed(4).replace('.', ',');
const lineasLog = (f, patrones) =>
  leer(EVID, 'script', f).split('\n').filter((l) => patrones.some((r) => r.test(l)));
// Los logs reales son anchos: se compacta a "hora NIVEL [app] clase: mensaje" y se recorta para que quepa en la página.
const compacto = (l, n = 96) => {
  const m = l.match(/^\S+T([\d:.]+)-05:00\s+(\w+)\s+\d+ --- \[(.*?)\] \[.*?\] (\S+)\s+: (.*)$/);
  const corto = m ? `${m[1]} ${m[2].padEnd(5)} [${m[3].replace('microservicio-', '')}] ${m[4].split('.').pop()}: ${m[5]}` : l;
  return corto.length > n ? corto.slice(0, n - 1) + '…' : corto;
};

// Valores agregados (sin filtrar por URI) transcritos de las capturas 06, 08, 09 y 11:
// el agregado incluye Actuator y /favicon.ico, por eso no es un contador "limpio" de /pedidos/{id}.
const AGREGADO = {
  pedidos: { antes: { count: 3, total: 0.184089, max: 0.0851895 }, despues: { count: 18, total: 0.2762155, max: 0.0851895 } },
  productos: { antes: { count: 3, total: 0.0929059, max: 0.0652165 }, despues: { count: 21, total: 0.19347, max: 0.0652165 } },
};

// ---------- imágenes ----------
function dimensionesPng(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ---------- bloques de documento ----------
const t = (text, o = {}) => new TextRun({ text, ...o });
const parrafo = (children, o = {}) =>
  new Paragraph({ spacing: { after: 120, line: 276 }, ...o, children: typeof children === 'string' ? [t(children)] : children });
const h1 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(s)] });
const h2 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(s)] });
const punto = (children) =>
  new Paragraph({ numbering: { reference: 'vinetas', level: 0 }, spacing: { after: 60 }, children: typeof children === 'string' ? [t(children)] : children });
const mono = (s) => t(s, { font: 'Consolas', size: 20 });
const negrita = (s) => t(s, { bold: true });

function bloqueCodigo(lineas, titulo) {
  const out = [];
  if (titulo) out.push(new Paragraph({ keepNext: true, spacing: { before: 120, after: 40 }, children: [t(titulo, { italics: true, size: 20, color: '595959' })] }));
  lineas.forEach((l, i) => {
    out.push(new Paragraph({
      keepLines: true,
      keepNext: lineas.length <= 25 && i < lineas.length - 1,
      spacing: { before: 0, after: 0, line: 252 },
      indent: { left: 200 },
      shading: { type: ShadingType.CLEAR, fill: GRIS_CODIGO, color: 'auto' },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: AZUL, space: 6 } },
      children: [t(l === '' ? ' ' : l, { font: 'Consolas', size: 17 })],
    }));
  });
  out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return out;
}

const borde = { style: BorderStyle.SINGLE, size: 4, color: GRIS_BORDE };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };
function celda(contenido, ancho, { cabecera = false, mono: esMono = false, centro = false } = {}) {
  const runs = typeof contenido === 'string'
    ? [t(contenido, { bold: cabecera, color: cabecera ? 'FFFFFF' : undefined, font: esMono ? 'Consolas' : undefined, size: esMono ? 19 : 21 })]
    : contenido;
  return new TableCell({
    width: { size: ancho, type: WidthType.DXA },
    borders: bordes,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    shading: cabecera ? { type: ShadingType.CLEAR, fill: AZUL, color: 'auto' } : undefined,
    children: [new Paragraph({ alignment: centro ? AlignmentType.CENTER : undefined, spacing: { after: 0 }, children: runs })],
  });
}
function tabla(cabeceras, filas, anchos, opciones = {}) {
  const suma = anchos.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: suma, type: WidthType.DXA },
    columnWidths: anchos,
    rows: [
      new TableRow({ tableHeader: true, children: cabeceras.map((c, i) => celda(c, anchos[i], { cabecera: true })) }),
      ...filas.map((f) => new TableRow({
        cantSplit: true,
        children: f.map((c, i) => celda(c, anchos[i], { mono: (opciones.mono || []).includes(i) })),
      })),
    ],
  });
}
const espacio = () => new Paragraph({ spacing: { after: 160 }, children: [] });

// Recuadro visible cuando falta una captura: nunca se inventa evidencia.
function recuadroFalta(archivo, descripcion) {
  const b = { style: BorderStyle.DASHED, size: 8, color: 'C00000' };
  return new Table({
    width: { size: ANCHO, type: WidthType.DXA },
    columnWidths: [ANCHO],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: ANCHO, type: WidthType.DXA },
        borders: { top: b, bottom: b, left: b, right: b },
        margins: { top: 240, bottom: 240, left: 200, right: 200 },
        shading: { type: ShadingType.CLEAR, fill: 'FDF2F2', color: 'auto' },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [t(`[Falta la captura: ${archivo}]`, { bold: true, color: 'C00000' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [t(descripcion, { italics: true, size: 20, color: '7F7F7F' })] }),
        ],
      })],
    })],
  });
}

const faltantes = [];
let nFigura = 0;
function captura(base, descripcion) {
  nFigura += 1;
  const pie = new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [t(`Figura ${nFigura}. ${descripcion}`, { italics: true, size: 19, color: '595959' })] });
  const f = path.join(CAPTURAS, `${base}.png`);
  if (!fs.existsSync(f)) {
    faltantes.push(base);
    return [recuadroFalta(`${base}.png`, descripcion), pie];
  }
  const buf = fs.readFileSync(f);
  const d = dimensionesPng(buf);
  if (!d) throw new Error(`No se pudo leer el tamaño de ${f}`);
  const esc = Math.min(1, 600 / d.w);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true, spacing: { after: 0 },
      children: [new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(d.w * esc), height: Math.round(d.h * esc) }, altText: { title: descripcion, description: descripcion, name: base } })],
    }),
    pie,
  ];
}

// ---------- datos para las tablas ----------
const pedAntes = metrica('pedidos-uri-antes.json');
const pedDespues = metrica('pedidos-uri-despues.json');
const prodAntes = metrica('productos-uri-antes.json');
const prodDespues = metrica('productos-uri-despues.json');
const media = (m) => m.total / m.count;
const incremento = (a, d) => ({ count: d.count - a.count, total: d.total - a.total });
const incPed = incremento(pedAntes, pedDespues);
const incProd = incremento(prodAntes, prodDespues);

const hijos = [];
const add = (...x) => x.flat().forEach((e) => hijos.push(e));

// ---------- Portada ----------
add(
  new Paragraph({ spacing: { before: 2200, after: 200 }, children: [t('INFORME DE LABORATORIO', { size: 26, bold: true, color: '7F7F7F', characterSpacing: 60 })] }),
  new Paragraph({ spacing: { after: 160 }, children: [t('Observabilidad básica de microservicios con Spring Boot Actuator y Micrometer (sin Docker)', { size: 48, bold: true, color: AZUL })] }),
  new Paragraph({
    spacing: { after: 700 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: AZUL, space: 12 } },
    children: [t('Asignatura: Sistemas Distribuidos', { size: 28, color: '595959' })],
  }),
  tabla(['Dato', 'Detalle'], [
    ['Autor', AUTOR],
    ['Fecha', FECHA],
    ['Tecnologías', 'Java 21, Spring Boot 3.5.10, Spring Boot Actuator, Micrometer, Maven'],
    ['Repositorio', REPO_URL],
  ], [2200, ANCHO - 2200]),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 200 }, children: [t('Contenido', { size: 36, bold: true, color: AZUL })] }),
  new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---------- 1. Propósito ----------
add(
  h1('1. Propósito y alcance'),
  parrafo('Se implementaron dos microservicios REST independientes, se observaron sus indicadores de salud y sus métricas HTTP, se examinaron los registros (logs) y se analizó el efecto de que una dependencia remota deje de estar disponible.'),
  punto('Construir y ejecutar dos aplicaciones Spring Boot de forma simultánea.'),
  punto('Exponer y consultar los endpoints de Spring Boot Actuator.'),
  punto('Interpretar COUNT, TOTAL_TIME y MAX en las métricas HTTP.'),
  punto('Identificar logs de negocio y diferenciar la salud local de la disponibilidad de las dependencias.'),
  espacio(),
  tabla(['Componente', 'Rol', 'Puerto'], [
    ['microservicio-productos', 'Devuelve los datos de un producto (JSON)', '8081'],
    ['microservicio-pedidos', 'Consulta un pedido y obtiene el producto llamando por HTTP a productos', '8082'],
  ], [2900, 4426, 1700]),
  espacio(),
  parrafo([negrita('Flujo: '), t('Cliente HTTP → microservicio-pedidos (8082) → microservicio-productos (8081). Ambos publican /actuator/health y /actuator/metrics. No se usó Docker, MySQL, Prometheus ni Grafana.')]),
);

// ---------- 2. Entorno ----------
add(
  h1('2. Entorno utilizado'),
  tabla(['Elemento', 'Versión / detalle'], [
    ['Sistema operativo', 'Windows 11 Pro'],
    ['JDK', 'Eclipse Temurin 21.0.12'],
    ['Maven', 'Maven Wrapper (mvnw) con Apache Maven 3.9.11'],
    ['Spring Boot', '3.5.10 (rama 3.5.x que pide la guía)'],
    ['Dependencias', 'Spring Web y Spring Boot Actuator'],
    ['IDE', 'Visual Studio Code con Extension Pack for Java y Spring Boot Dashboard'],
    ['Navegador', 'Microsoft Edge'],
    ['Control de versiones', 'Git / GitHub'],
  ], [2600, ANCHO - 2600]),
  espacio(),
  h2('2.1 Diferencias respecto a la guía'),
  punto([negrita('IDE: '), t('la guía usa IntelliJ IDEA; se empleó Visual Studio Code. Las capturas de "ejecución en el IDE" corresponden al Spring Boot Dashboard y a la terminal de depuración de VS Code. Los proyectos son Maven estándar y se importan sin cambios en IntelliJ.')]),
  punto([negrita('Spring Boot 3.5.10: '), t('start.spring.io ya solo ofrece la rama 4.x, así que los proyectos se generaron allí para obtener el Maven Wrapper y el pom.xml se fijó a Spring Boot 3.5.10 con spring-boot-starter-web, tal como pide la guía.')]),
  punto([negrita('Archivo .http: '), t('pruebas-observabilidad.http se entrega tal cual en microservicio-pedidos; en VS Code se puede ejecutar con la extensión REST Client y en IntelliJ con su cliente HTTP.')]),
  punto([negrita('Parada de productos: '), t('en el experimento 2 el servicio de productos se detuvo terminando el proceso que escucha en el puerto 8081 (equivale al paso de "detener solo microservicio-productos").')]),
);

// ---------- 3. Productos ----------
add(
  h1('3. Microservicio de productos'),
  tabla(['Campo', 'Valor'], [
    ['Group / Artifact', 'com.ejemplo / microservicio-productos'],
    ['Package', 'com.ejemplo.productos'],
    ['Java / Packaging', '21 / Jar'],
    ['Dependencias', 'Spring Web, Spring Boot Actuator'],
  ], [3000, ANCHO - 3000]),
  h2('3.1 Configuración'),
  ...bloqueCodigo(codigo('microservicio-productos/src/main/resources/application.properties'), 'src/main/resources/application.properties'),
  h2('3.2 Controlador'),
  ...bloqueCodigo(codigo('microservicio-productos/src/main/java/com/ejemplo/productos/controller/ProductoController.java'), 'src/main/java/com/ejemplo/productos/controller/ProductoController.java'),
  parrafo('El controlador registra un mensaje de negocio por cada consulta y devuelve un Map con id, nombre y precio. Esa línea de log es la que se busca luego en la consola.'),
);

// ---------- 4. Pedidos ----------
add(
  h1('4. Microservicio de pedidos'),
  tabla(['Campo', 'Valor'], [
    ['Group / Artifact', 'com.ejemplo / microservicio-pedidos'],
    ['Package', 'com.ejemplo.pedidos'],
    ['Java / Packaging', '21 / Jar'],
    ['Dependencias', 'Spring Web, Spring Boot Actuator'],
  ], [3000, ANCHO - 3000]),
  h2('4.1 Configuración'),
  ...bloqueCodigo(codigo('microservicio-pedidos/src/main/resources/application.properties'), 'src/main/resources/application.properties'),
  h2('4.2 Cliente HTTP'),
  ...bloqueCodigo(codigo('microservicio-pedidos/src/main/java/com/ejemplo/pedidos/RestClientConfig.java'), 'src/main/java/com/ejemplo/pedidos/RestClientConfig.java'),
  h2('4.3 Controlador de pedidos'),
  ...bloqueCodigo(codigo('microservicio-pedidos/src/main/java/com/ejemplo/pedidos/controller/PedidoController.java'), 'src/main/java/com/ejemplo/pedidos/controller/PedidoController.java'),
  parrafo('Para simplificar el taller se usa Map como representación de datos. En un proyecto real conviene definir DTO tipados, validación, timeout y manejo de errores; precisamente la ausencia de timeout y de manejo de errores es lo que hace visible el fallo del experimento 2.'),
);

// ---------- 5. Ejecución simultánea ----------
add(
  h1('5. Ejecución simultánea'),
  parrafo('Se inició primero microservicio-productos (8081) y después microservicio-pedidos (8082) desde el Spring Boot Dashboard de VS Code, sin detener el primero. Tras consultar /pedidos/1 aparecen registros de consulta en ambas consolas.'),
  h2('5.1 Ambos microservicios en ejecución'),
  ...captura('01-vscode-pedidos-ejecutando', 'VS Code: Spring Boot Dashboard con ambas aplicaciones y la consola de microservicio-pedidos (puerto 8082) con sus logs de negocio.'),
  ...captura('02-vscode-productos-ejecutando', 'VS Code: consola de microservicio-productos (puerto 8081) con la línea "Consultando producto con ID 1".'),
  h2('5.2 Respuesta de /pedidos/1'),
  parrafo([t('Resultado esperado y obtenido: JSON con '), mono('pedidoId=1'), t(', '), mono('estado=PROCESADO'), t(' y el objeto '), mono('producto'), t(' anidado.')]),
  ...captura('03-json-pedidos-1', 'GET http://localhost:8082/pedidos/1: respuesta JSON de pedidos con el producto anidado.'),
  parrafo('Ejecución verificada también con pruebas automáticas: mvnw test en cada módulo (productos: 2 pruebas; pedidos: 3 pruebas, con el servicio de productos simulado) y el script docs/scripts/ejecutar-experimentos.ps1.'),
);

// ---------- 6. Actuator ----------
add(
  h1('6. Exploración de Actuator'),
  tabla(['URL', 'Qué se observa'], [
    ['http://localhost:8081/actuator/health', 'Salud del servicio de productos'],
    ['http://localhost:8082/actuator/health', 'Salud del servicio de pedidos'],
    ['http://localhost:8082/actuator/metrics', 'Nombres de las métricas disponibles'],
    ['http://localhost:8082/actuator/metrics/http.server.requests', 'Mediciones HTTP de pedidos'],
    ['http://localhost:8081/actuator/metrics/http.server.requests', 'Mediciones HTTP de productos'],
  ], [4800, ANCHO - 4800], { mono: [0] }),
  espacio(),
  parrafo([t('Con '), mono('management.endpoint.health.show-details=always'), t(' el health muestra sus componentes (diskSpace, ping y ssl). Ambos servicios responden '), mono('"status":"UP"'), t('.')]),
  ...captura('04-health-productos', 'GET http://localhost:8081/actuator/health: microservicio-productos en estado UP.'),
  ...captura('05-health-pedidos', 'GET http://localhost:8082/actuator/health: microservicio-pedidos en estado UP.'),
);

// ---------- 7. Experimento 1 ----------
add(
  h1('7. Experimento 1: métricas de solicitudes'),
  parrafo('Procedimiento: se consultó una vez /pedidos/1, se anotaron COUNT, TOTAL_TIME y MAX de http.server.requests, se hicieron diez solicitudes adicionales y se comparó. Después se repitió la consulta de métricas en productos (8081).'),
  h2('7.1 Indicadores'),
  tabla(['Indicador', 'Significado'], [
    ['COUNT', 'Número de peticiones registradas en la serie consultada'],
    ['TOTAL_TIME', 'Suma de la duración registrada, en segundos (baseUnit = seconds)'],
    ['MAX', 'Tiempo máximo observado en la ventana del medidor'],
  ], [2200, ANCHO - 2200], { mono: [0] }),
  espacio(),
  h2('7.2 Tabla antes / después (filtrada por URI)'),
  parrafo([t('Para no mezclar las llamadas a Actuator con las de negocio se filtró la serie con '), mono('?tag=uri:/pedidos/{id}'), t(' (y '), mono('/productos/{id}'), t(' en el otro servicio). Tiempos en segundos.')]),
  tabla(['Servicio / URI', 'Momento', 'COUNT', 'TOTAL_TIME (s)', 'MAX (s)', 'Media (s)'], [
    ['pedidos /pedidos/{id}', 'Antes (1 consulta)', String(pedAntes.count), s3(pedAntes.total), s3(pedAntes.max), s3(media(pedAntes))],
    ['pedidos /pedidos/{id}', 'Después (+10)', String(pedDespues.count), s3(pedDespues.total), s3(pedDespues.max), s3(media(pedDespues))],
    ['productos /productos/{id}', 'Antes (1 consulta)', String(prodAntes.count), s3(prodAntes.total), s3(prodAntes.max), s3(media(prodAntes))],
    ['productos /productos/{id}', 'Después (+10)', String(prodDespues.count), s3(prodDespues.total), s3(prodDespues.max), s3(media(prodDespues))],
  ], [2300, 1900, 900, 1500, 1200, 1226]),
  espacio(),
  h2('7.3 Tabla antes / después (agregada, sin filtrar)'),
  parrafo('Es lo que devuelve la URL sin filtros, transcrito de las capturas. Incluye las propias consultas a /actuator y peticiones 404 del navegador (/favicon.ico), por eso los COUNT no son 1 y 11.'),
  tabla(['Servicio', 'Momento', 'COUNT', 'TOTAL_TIME (s)', 'MAX (s)'], [
    ['pedidos (8082)', 'Antes', String(AGREGADO.pedidos.antes.count), s3(AGREGADO.pedidos.antes.total), s3(AGREGADO.pedidos.antes.max)],
    ['pedidos (8082)', 'Después', String(AGREGADO.pedidos.despues.count), s3(AGREGADO.pedidos.despues.total), s3(AGREGADO.pedidos.despues.max)],
    ['productos (8081)', 'Antes', String(AGREGADO.productos.antes.count), s3(AGREGADO.productos.antes.total), s3(AGREGADO.productos.antes.max)],
    ['productos (8081)', 'Después', String(AGREGADO.productos.despues.count), s3(AGREGADO.productos.despues.total), s3(AGREGADO.productos.despues.max)],
  ], [2300, 1900, 1100, 1900, 1826]),
  espacio(),
  h2('7.4 Interpretación'),
  punto([negrita('COUNT: '), t(`en pedidos pasó de ${pedAntes.count} a ${pedDespues.count} (+${incPed.count}) y en productos de ${prodAntes.count} a ${prodDespues.count} (+${incProd.count}): cada petición a pedidos provoca exactamente una a productos, por eso ambos contadores crecen igual.`)]),
  punto([negrita('TOTAL_TIME: '), t(`es acumulativo. En pedidos subió ${s3(incPed.total)} s con ${incPed.count} peticiones nuevas (≈ ${s3(incPed.total / incPed.count)} s cada una), y en productos ${s3(incProd.total)} s (≈ ${s3(incProd.total / incProd.count)} s cada una). Pedidos tarda más porque su tiempo incluye la llamada HTTP a productos.`)]),
  punto([negrita('MAX: '), t(`no cambió (${s3(pedAntes.max)} s en pedidos y ${s3(prodAntes.max)} s en productos): lo marcó la primera petición, más lenta por la inicialización perezosa de clases, serialización JSON y conexión del cliente. Las diez siguientes fueron más rápidas, así que el máximo se conserva. La media (TOTAL_TIME / COUNT) baja de ${s3(media(pedAntes))} s a ${s3(media(pedDespues))} s en pedidos.`)]),
  punto([negrita('Agregado frente a filtrado: '), t('la serie sin filtrar mezcla /actuator/health, /actuator/metrics, /pedidos/{id} y las rutas 404; para analizar un endpoint conviene filtrar por tag uri y revisar availableTags.')]),
  ...captura('06-metricas-pedidos-antes', 'Métricas HTTP de pedidos, antes de las diez solicitudes (serie agregada).'),
  ...captura('07-metricas-pedidos-uri-antes', 'Métricas HTTP de pedidos filtradas por uri=/pedidos/{id}, antes.'),
  ...captura('08-metricas-productos-antes', 'Métricas HTTP de productos, antes (serie agregada).'),
  ...captura('09-metricas-pedidos-despues', 'Métricas HTTP de pedidos, después de las diez solicitudes (serie agregada).'),
  ...captura('10-metricas-pedidos-uri-despues', 'Métricas HTTP de pedidos filtradas por uri=/pedidos/{id}, después.'),
  ...captura('11-metricas-productos-despues', 'Métricas HTTP de productos, después (serie agregada).'),
);

// ---------- 8. Experimento 2 ----------
const logPedidosOk = lineasLog('consola-pedidos.txt', [/Iniciando consulta del pedido/, /Consulta del producto finalizada/]).slice(0, 2);
const logProductosOk = lineasLog('consola-productos.txt', [/Consultando producto con ID/]).slice(0, 1);
const logError = lineasLog('consola-pedidos.txt', [/ERROR .*dispatcherServlet/]).slice(0, 1);
add(
  h1('8. Experimento 2: logs y fallo de dependencia'),
  parrafo('Procedimiento: con ambos servicios respondiendo bien se detuvo solo microservicio-productos (8081), se consultó /pedidos/1, se observó el error y el log de excepción, se consultó /actuator/health de pedidos y se reinició productos para comprobar la recuperación.'),
  h2('8.1 Logs con ambos servicios activos'),
  ...bloqueCodigo([...logPedidosOk, ...logProductosOk].map((l) => compacto(l)), 'Líneas de negocio de ambas consolas (ejecución por script, docs/evidencias/script/)'),
  h2('8.2 Con productos detenido'),
  parrafo([t('La consulta '), mono('GET /pedidos/1'), t(' devuelve HTTP 500 (página de error de Spring Boot) y la consola de pedidos registra la excepción:')]),
  ...bloqueCodigo(logError.map((l) => compacto(l, 92)), 'Línea de error en la consola de pedidos (ejecución por script)'),
  parrafo([t('La causa raíz es '), mono('java.nio.channels.ClosedChannelException'), t(' / conexión rechazada hacia '), mono('http://localhost:8081/productos/1'), t(', envuelta en '), mono('ResourceAccessException'), t('.')]),
  ...captura('12-vscode-pedidos-error-productos-caido', 'VS Code: consola de microservicio-pedidos con la excepción al estar productos detenido.'),
  ...captura('13-pedidos-http-500', 'GET /pedidos/1 con productos detenido: HTTP 500.'),
  h2('8.3 ¿Permanece UP el health de pedidos?'),
  parrafo([negrita('Sí. '), t('Aunque la operación de negocio falla, /actuator/health de pedidos sigue devolviendo '), mono('"status":"UP"'), t('. Es el comportamiento esperado y deliberado en el ejemplo: el health predeterminado solo comprueba indicadores locales (diskSpace, ping, ssl) y no sondea el servicio HTTP remoto.')]),
  ...captura('14-health-pedidos-productos-caido', 'GET /actuator/health de pedidos con productos detenido: sigue en UP.'),
  h2('8.4 Recuperación'),
  parrafo('Al reiniciar microservicio-productos, pedidos vuelve a responder 200 con el JSON completo sin necesidad de reiniciarlo: no mantiene estado de la conexión caída.'),
  ...captura('15-pedidos-recuperado', 'GET /pedidos/1 tras reiniciar productos: respuesta normal.'),
);

// ---------- 9. Preguntas ----------
add(
  h1('9. Preguntas de análisis'),
  parrafo([negrita('1. ¿Qué diferencia existe entre COUNT y TOTAL_TIME?')]),
  parrafo(`COUNT es cuántas peticiones se han registrado; TOTAL_TIME es la suma de cuánto tardaron todas. Son acumulativos desde el arranque. Con ambos se obtiene la media (TOTAL_TIME / COUNT): en pedidos, ${pedDespues.count} peticiones sumaron ${s3(pedDespues.total)} s, es decir ${s3(media(pedDespues))} s por petición. Un COUNT alto con TOTAL_TIME bajo significa tráfico rápido; un COUNT bajo con TOTAL_TIME alto, peticiones lentas.`),
  parrafo([negrita('2. ¿Por qué el servicio pedidos puede mostrar UP si productos está detenido?')]),
  parrafo('Porque el health predeterminado de Spring Boot solo evalúa la salud del propio proceso (disco, ping, SSL). Saber si pedidos está "vivo" no es lo mismo que saber si puede cumplir su función. Para reflejar la dependencia habría que añadir un HealthIndicator propio que sondee a productos, o aplicar timeouts y un circuit breaker, y distinguir liveness de readiness.'),
  parrafo([negrita('3. ¿Qué datos de observabilidad permitirían detectar degradación de rendimiento?')]),
  punto('La media y el máximo de http.server.requests por URI (TOTAL_TIME / COUNT y MAX), y sobre todo percentiles (p95/p99) con histogramas habilitados.'),
  punto('La tasa de respuestas con outcome SERVER_ERROR o status 5xx, y la serie de excepciones (tag exception).'),
  punto('Métricas de la JVM y del servidor (hilos, memoria, GC, conexiones) y métricas del cliente HTTP hacia productos.'),
  punto('Logs con duración por operación y, mejor, trazas que muestren en qué salto se pierde el tiempo.'),
  parrafo([negrita('4. ¿Qué aporta una traza distribuida que no da el log individual de cada servicio?')]),
  parrafo('Una traza une, con un identificador común (traceId), todas las operaciones de una petición a través de varios servicios y muestra la jerarquía y la duración de cada tramo (span). El log de cada servicio solo ve su parte: hay que correlacionar a mano marcas de tiempo. Con la traza se ve directamente que "/pedidos/1 tardó X ms, de los cuales Y fueron la llamada a productos", o en qué servicio se originó el error. Queda como ampliación (Micrometer Tracing con Zipkin).'),
  parrafo([negrita('5. ¿Qué riesgos tiene exponer /actuator/metrics y /actuator/health con detalles en producción?')]),
  punto('Revelan información interna: rutas internas, versiones, espacio en disco y rutas del sistema de archivos (se vio el path local en diskSpace), nombres de beans, URIs y patrones de uso. Eso facilita el reconocimiento previo a un ataque.'),
  punto('Sin autenticación, cualquiera puede consultarlos repetidamente (consumo de recursos) y deducir el estado del sistema.'),
  punto('Mitigación: exponer solo lo necesario, mover Actuator a un puerto de gestión interno (management.server.port), protegerlo con Spring Security, usar show-details=when-authorized y limitar el acceso por red.'),
);

// ---------- 10. Conclusión ----------
add(
  h1('10. Conclusión'),
  punto([negrita('Métricas, logs y trazas. '), t('Las métricas son números agregados en el tiempo (cuántas peticiones, cuánto tardan) y responden "¿qué está pasando en general?"; son baratas y buenas para alertar. Los logs son eventos puntuales con contexto y responden "¿qué pasó exactamente en este momento?". Las trazas siguen una petición concreta a través de varios servicios y responden "¿dónde se fue el tiempo o se produjo el fallo?". Se complementan: la métrica avisa, la traza localiza y el log explica.')]),
  punto([negrita('Limitación del health predeterminado. '), t('Solo refleja la salud local del proceso. Pedidos siguió en UP mientras todas sus peticiones fallaban con HTTP 500 porque su dependencia estaba caída; un orquestador o balanceador que se guíe solo por ese health seguiría enviándole tráfico. Hace falta incluir las dependencias críticas en un indicador de readiness, además de timeouts y manejo de errores.')]),
  punto([negrita('Resultado. '), t('Ambos microservicios se ejecutaron simultáneamente, se comprobó la comunicación HTTP, las métricas crecieron como se esperaba (COUNT 1 → 11 en la serie de negocio), el fallo de la dependencia quedó registrado en logs y el servicio se recuperó al reiniciar productos.')]),
  punto([negrita('Buenas prácticas pendientes. '), t('Configuración académica y local: en producción restringir los endpoints de administración, no mostrar detalles de salud públicamente, establecer timeouts, instrumentar las dependencias y centralizar la recolección (Prometheus y Grafana, y Micrometer Tracing con Zipkin como siguiente práctica).')]),
);

// ---------- 11. Repositorio ----------
add(
  h1('11. Repositorio y reproducción'),
  parrafo([t('Código, pruebas, evidencias y este informe: '), t(REPO_URL, { color: '2F5496', underline: {} })]),
  ...bloqueCodigo([
    '# Terminal 1',
    'cd microservicio-productos && ./mvnw spring-boot:run     # :8081',
    '# Terminal 2',
    'cd microservicio-pedidos && ./mvnw spring-boot:run       # :8082',
    '',
    'curl http://localhost:8082/pedidos/1',
    'curl http://localhost:8082/actuator/metrics/http.server.requests',
  ], 'Ejecución rápida'),
  parrafo('El script docs/scripts/ejecutar-experimentos.ps1 repite los experimentos completos y regraba las evidencias de texto en docs/evidencias/script/.'),
);

const doc = new Document({
  creator: AUTOR,
  title: 'Informe de laboratorio: observabilidad de microservicios con Spring Boot Actuator',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 34, bold: true, color: AZUL, font: 'Calibri' }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: '2F5496', font: 'Calibri' }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [t('Laboratorio de observabilidad  |  Página ', { size: 18, color: '7F7F7F' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '7F7F7F' })],
        })],
      }),
    },
    children: hijos,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(SALIDA, buf);
  console.log(`Informe generado: ${SALIDA} (${(buf.length / 1024).toFixed(0)} KB)`);
  if (faltantes.length) console.log(`Capturas pendientes (${faltantes.length}): ${faltantes.join(', ')}`);
});
