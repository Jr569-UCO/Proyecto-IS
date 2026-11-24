# Pruebas y verificación

## Entorno y resultado

Verificación realizada el 24 de noviembre de 2026 con **Node 26.13.1**, SQLite incluido en Node y Firefox del entorno local.

- **38 pruebas superadas** de sistema, HTTP y persistencia: 28 casos de reglas/acceso, un caso de persistencia y nueve resultados del recorrido HTTP (incluye el contenedor de sus ocho subpruebas).
- **Un recorrido adicional de navegador superado**, con operaciones reales desde los formularios y revisión a 1440 × 1080 y 390 × 844.
- Comprobación de sintaxis y construcción: correcta. No se ha ejecutado el chequeo estático de `tsc`.
- Reinicio de datos con copia: probado con una base temporal en `/tmp`; tras reiniciarla conserva las ocho cuentas de la semilla.

Los resultados no equivalen a cobertura completa, certificación de seguridad o pruebas de carga.

## Cómo ejecutar

Desde `prototipo/`:

```bash
node scripts/check.ts
node --test --test-isolation=none tests/*.test.ts
```

No necesitas paquetes externos. Las pruebas HTTP abren un puerto temporal en `127.0.0.1`; el entorno debe permitir conexiones locales. El resto usa SQLite en memoria o un directorio temporal que se elimina al terminar. No se cambia `data/prototipo.sqlite`.

Para un caso concreto:

```bash
node --test --test-isolation=none --test-name-pattern="Prioridad" tests/system.test.ts
```

Se usa `--test-isolation=none` para que los resultados individuales sean visibles también en este entorno. Cada prueba mantiene su propia base y su propio reloj.

## Casos importantes

| Área | Entrada o escenario | Resultado esperado |
| --- | --- | --- |
| Acceso | Contraseña incorrecta | Rechazo con mensaje de credenciales |
| Contrato | Cuenta vencida | Acceso denegado |
| Sesión | Ocho horas transcurridas o logout | Token ya no válido |
| Fecha | Verano/invierno de Madrid, 30 de febrero | Desfase correcto / fecha imposible rechazada |
| Horario | 08–20; 07:59; fin antes de inicio | Aceptar / rechazar / rechazar |
| Intervalos | Una termina cuando otra empieza | Compatibles |
| UCO | Repetir una reserva UCO existente | Conflicto; se conserva la primera |
| Prioridad | Externa a más de siete días | Desplazada, aviso y nueva reserva |
| Límite de prioridad | Exactamente siete días o menos | Reserva externa protegida |
| Técnicos | Ambos ocupados en otros equipos | Nueva sesión rechazada |
| Sala | Dos instrumentos autónomos distintos | Reservas simultáneas permitidas |
| Transacción | Fallo SQL al insertar un aviso | Se revierten reserva y desplazamiento |
| Cancelación | 24 horas exactas / menos de 24 | Gratuita / facturable |
| Propiedad | Cancelar una reserva ajena | Denegado |
| Avería | Parte sobre equipo con futuras citas | Bloqueo, citas conservadas y avisos |
| Reparación | Resolver solo una de dos averías | El equipo permanece bloqueado |
| Mantenimiento | Coincidir con una cita existente | Rechazo sin mover la cita |
| Uso real | Técnico ajeno, inicio anticipado o fin sin inicio | Denegado |
| Informe | Sesión que cruza un cambio de mes | Solo cuenta la parte del mes seleccionado |
| Cancelación e informe | Sesión cancelada tarde | Horas previstas separadas del uso real |
| Privacidad | Solicitar estado como investigador | Sin identidad, entidad o motivo ajeno |
| Persistencia | Cerrar y reabrir la base | Reserva y sesión siguen presentes |
| HTTP | CSRF incorrecto u origen diferente | 403 |
| HTTP | JSON sin campos obligatorios | 400, sin excepción interna expuesta |
| Archivos | Solicitar `src/` o SQLite | 404 |
| CSV | Exportar mes con consumo | Descarga con cabecera y filas esperadas |

## Revisión del navegador

El script `scripts/browser-check.ts` utiliza WebDriver BiDi y el `WebSocket` incluido en Node. Necesitas Firefox instalado; es una herramienta de verificación opcional, no una dependencia para utilizar la app.

Primera terminal (crea antes el directorio del perfil si no existe):

```bash
mkdir -p /tmp/sg-cict-firefox
firefox --headless --no-remote --profile /tmp/sg-cict-firefox --remote-debugging-port 9223
```

Segunda terminal, desde `prototipo/`:

```bash
node --test --test-isolation=none scripts/browser-check.ts
```

Se crea otro servidor en un puerto aleatorio y una base en memoria. No hace falta arrancar el servidor principal. Se verifican acceso, filtros, disponibilidad, reserva, cancelación, incidencia, reparación, alta externa, informes, documentos, navegación móvil, ocultación de opciones según perfil y rechazo de cuenta vencida. El script comprueba que el navegador no haya registrado errores de JavaScript.

También comprueba que el documento móvil no desborde horizontalmente. Las tablas pueden desplazarse dentro de su propio contenedor. La sesión BiDi se cierra al finalizar; detén después Firefox con `Ctrl+C`.

### Capturas reales

- [Acceso](capturas/01-acceso.png).
- [Panel principal](capturas/02-panel.png).
- [Catálogo](capturas/03-catalogo.png).
- [Informe mensual](capturas/04-informes.png).
- [Panel móvil](capturas/05-movil.png).

Las capturas proceden de la base de prueba y sus operaciones; no son diseños simulados ni pantallas con datos de producción.

## Hallazgos y correcciones durante la construcción

| Hallazgo | Causa y corrección |
| --- | --- |
| Una prueba de uso real no podía empezar una nueva sesión | La semilla mantenía una sesión anterior del mismo técnico en uso. La prueba cierra esa sesión antes de avanzar su reloj; se conserva la protección real del sistema. |
| El documento desbordaba a 390 px | Un texto accesible posicionado dentro de la tabla tomaba una referencia fuera del contenedor desplazable. Se posicionó el contenedor para que el contenido permanezca dentro de su área. La prueba del ancho del documento verifica la corrección. |
| Captura móvil tomada durante la transición del menú | El script espera a que el panel lateral quede fuera de pantalla antes de capturar. |

## Qué añadir antes de una entrega final

Asignar autoría real a las pruebas, incorporar la plantilla de Moodle con entrada/esperado/obtenido, ampliar combinaciones concurrentes, verificar rendimiento del catálogo en el entorno final y revisar controles de despliegue. La colección incluida es una base de estudio, no una sustitución del trabajo individual solicitado por la asignatura.
