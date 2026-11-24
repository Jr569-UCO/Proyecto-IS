# SG-CICT · Prototipo para aprender

Aplicación web funcional del Sistema de Gestión del Centro de Instrumentación Científico-Técnico: **TypeScript en navegador y servidor, HTML, CSS y SQLite**. Todo el trabajo está contenido en esta carpeta. Los datos son ficticios.

## Arranque en un minuto

Necesitas **Node.js 24 o superior** con sus módulos `node:sqlite` y `node:module`. Se ha verificado con Node 26.13.1. No necesitas instalar paquetes, un servidor SQL ni herramientas de compilación.

Desde la raíz del repositorio:

```bash
cd prototipo
node src/server.ts
```

Abre **http://localhost:4173**. El primer arranque crea y rellena `data/prototipo.sqlite`. Detén el proceso con `Ctrl+C`. Debes mantener la terminal abierta mientras utilizas la aplicación. Abre la URL del servidor, no `public/index.html` directamente.

Si tienes npm, `npm start` ejecuta el mismo comando. Para reiniciar automáticamente el servidor al editar el código del servidor: `node --watch src/server.ts`.

Tras editar TypeScript del navegador (`public/*.ts`), reinicia el servidor y recarga. Los cambios de HTML y CSS se leen al recargar.

## Perfiles de ejemplo

Todas estas cuentas utilizan la contraseña **`Demo2026!`**. Son credenciales públicas de demostración.

| Correo | Perfil | Qué probar |
| --- | --- | --- |
| `admin@demo.local` | Administración | Todas las pantallas, altas y contratos |
| `uco@demo.local` | Investigación UCO | Reservas, prioridad y avisos |
| `externa@demo.local` | Investigación externa | Reservas y protección de citas |
| `tecnico@demo.local` | Personal técnico | Mantenimiento, reparación y uso real |
| `tecnico2@demo.local` | Segundo técnico | Disponibilidad y asignación automática |
| `contable@demo.local` | Contabilidad | Informe mensual y exportación CSV |
| `consulta@demo.local` | Personal de consulta | Catálogo y ocupación, sin modificar recursos |
| `caducado@demo.local` | Contrato vencido | Rechazo del acceso |

Los cuatro botones de la pantalla de acceso permiten entrar en los perfiles más útiles sin escribir las credenciales.

## Vista del resultado

[Panel de escritorio](docs/capturas/02-panel.png) · [Catálogo](docs/capturas/03-catalogo.png) · [Vista móvil](docs/capturas/05-movil.png)

## Qué puedes hacer

- Consultar el catálogo, buscar por técnica/nombre/código y ver la ocupación.
- Crear reservas de 08:00 a 20:00, con asignación automática de técnico.
- Verificar disponibilidad antes de reservar. El servidor vuelve a comprobarla al confirmar.
- Aplicar prioridad UCO sobre reservas externas a más de siete días.
- Cancelar; distinguir cancelaciones gratuitas y tardías facturables.
- Abrir incidencias, bloquear equipos, notificar afectados y registrar reparaciones.
- Programar mantenimientos sin desplazar citas existentes.
- Registrar comienzo y fin del uso real, con permisos técnicos.
- Consultar consumo mensual por cliente/instrumento y descargarlo como CSV.
- Crear cuentas externas, editar contratos, cerrar sesiones y leer notificaciones.
- Consultar desde la propia web la guía y los documentos de implementación.

El navegador muestra el resultado; **las comprobaciones importantes se ejecutan en el servidor**. SQLite conserva los cambios al recargar o reiniciar.

## Cómo estudiar el proyecto

1. [Guía de lectura del código](docs/GUIA-CODIGO.md): sigue un clic hasta su persistencia.
2. [Arquitectura](docs/ARQUITECTURA.md): módulos, modelo y responsabilidades.
3. [Manual de usuario](docs/MANUAL-USUARIO.md): recorridos y ejemplos completos.
4. [API](docs/API.md): operaciones HTTP y permisos.
5. [Requisitos](docs/REQUISITOS.md): correspondencia con la P2.
6. [Decisiones](docs/DECISIONES.md): reglas ambiguas y alcance de la demostración.
7. [Pruebas](docs/PRUEBAS.md): cómo ejecutar y ampliar la verificación.
8. [Plan de trabajo](docs/PLAN-TRABAJO.md): propuesta de reparto y sprints.

## Verificación

```bash
node scripts/check.ts
node --test --test-isolation=none tests/*.test.ts
```

La primera orden comprueba sintaxis TypeScript, transformación para el navegador y creación del esquema. **Node elimina las anotaciones de tipos; no ejecuta el chequeo estático de `tsc`.** Las pruebas usan bases temporales/en memoria y no cambian los datos de tu aplicación. Las pruebas HTTP necesitan abrir puertos locales temporales.

## Datos y configuración

- `PORT=4300 node src/server.ts`: cambiar el puerto en Linux/macOS.
- `CICT_DB=/tmp/otra-demo.sqlite node src/server.ts`: usar otra base.
- En PowerShell: `$env:PORT = '4300'`, después `node src/server.ts`.
- Escucha en `127.0.0.1`; es un entorno local de estudio.
- Las fechas se interpretan en `Europe/Madrid`, también en verano.
- Las cuentas y equipos de ejemplo se insertan solo si la base está vacía.
- Para reiniciar la demostración, detén el servidor y ejecuta `node scripts/reset.ts --confirmar`. Se genera antes una copia de seguridad.

Los archivos SQLite y sus copias no se incluyen en Git. El código, el esquema y los datos iniciales sí permiten reproducir el entorno.

## Alcance honesto

El acceso institucional se simula con cuentas locales: **no se conecta a Moodle**. Los correos se representan mediante la bandeja de notificaciones: **no se envían mensajes reales**. El despliegue institucional, tarifas, cobros, calendario laboral de técnicos y validación normativa requieren trabajo adicional. Consulta [las decisiones](docs/DECISIONES.md).

La documentación está en español para estudiar el ejemplo. No se presenta como memoria final ni sustituye las plantillas de Moodle, el trabajo semanal del equipo o el formato/idioma que exija el profesor.

## Fuentes

- [P2 del equipo](../docs/entregas/P2_equipo204.pdf): requisitos RF-01 a RF-30 y puntos P-01 a P-09.
- [Enunciado P4](../docs/enunciados/p4-enunciado.pdf) y [diapositivas 2026/27](../docs/enunciados/p4-diapositivas.pdf).
- [Node: ejecución de TypeScript](https://nodejs.org/api/typescript.html), [SQLite](https://nodejs.org/api/sqlite.html), [criptografía](https://nodejs.org/api/crypto.html) y [pruebas](https://nodejs.org/api/test.html).

Este prototipo utiliza los módulos incluidos en Node y recursos visuales dibujados con SVG/CSS. No carga tipografías, scripts, imágenes ni servicios externos.
