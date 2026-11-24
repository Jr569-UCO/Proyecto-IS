# Correspondencia con vuestra P2

Fuente: `docs/entregas/P2_equipo204.pdf` del repositorio. «Implementado» se refiere al recorrido local de este prototipo; no supone despliegue institucional o aceptación de la entrega.

| Requisito | Comportamiento observable | Ubicación principal |
| --- | --- | --- |
| RF-01 | Acceso local autorizado y contrato vigente | `auth.ts` |
| RF-02 | **Simulado**: cuenta UCO local; integración Moodle pendiente | `auth.ts`, `seed.ts` |
| RF-03 | Alta externa por administración | `system.ts`, usuarios |
| RF-04 | Catálogo, ocupación y consulta de disponibilidad | `snapshot`, `availability` |
| RF-05 | Reservas ajenas anonimizadas para investigación/consulta | `snapshot` |
| RF-06 | Reserva de instrumento e intervalo | `createBooking` |
| RF-07 | Experimentos entre 08:00 y 20:00 de Madrid | `validateSlot` |
| RF-08 | Sin máximo artificial de reservas por persona | `createBooking` |
| RF-09 | Asignación automática de técnico activo libre | `plan` |
| RF-10 | Rechazo si no queda técnico disponible | `plan` |
| RF-11 | Detección de solapamiento de instrumento y técnico | `plan` |
| RF-12 | Una reserva UCO existente no se desplaza | `plan` |
| RF-13 | UCO desplaza citas externas a más de siete días | `plan`, `createBooking` |
| RF-14 | **Simulado**: aviso persistente al usuario desplazado | `notify`, bandeja |
| RF-15 | Reserva externa protegida a siete días o menos | `plan` |
| RF-16 | Cancelación gratuita con al menos 24 horas | `cancelBooking` |
| RF-17 | Cancelación posterior registrada como facturable | `cancelBooking`, `report` |
| RF-18 | Instrumentos distintos pueden compartir sala y horario | `plan` |
| RF-19 | Parte por investigación/técnico/admin | `createIncident` |
| RF-20 | Parte cambia el equipo a averiado | `createIncident` |
| RF-21 | Equipo averiado rechaza nuevas sesiones | `plan` |
| RF-22 | Avería persiste hasta resolver todos sus partes | `resolveIncident` |
| RF-23 | **Simulado**: avisos por avería a cada afectado | `notify`, bandeja |
| RF-24 | Reserva técnica de mantenimiento | `createBooking` |
| RF-25 | Mantenimiento incompatible se rechaza; no mueve citas | `plan` |
| RF-26 | Inicio/fin por técnico asignado; admin en equipos autónomos | `recordUsage` |
| RF-27 | Consumo mensual por cliente y equipo | `report` |
| RF-28 | CSV de horas separado por conceptos; sin tarifas/pagos | `report`, ruta CSV |
| RF-29 | Pantalla con contacto **ficticio identificado** | `contact` |
| RF-30 | Admin puede ejecutar todas las operaciones respetando reglas | `allow` y rutas |

## Información modelada

Las cuentas distinguen UCO/externos y perfiles internos; el catálogo incluye sala, estado y necesidad de técnico. Las reservas conservan persona, equipo, técnico e intervalos previstos/reales. Los partes registran descripción y resolución. Los informes agrupan consumo.

La disponibilidad no incluye turnos/festivos/especialidades: se utiliza el horario 08–20 y la ocupación registrada. Los contratos y clientes están simplificados como datos de cuenta. Consulta `DECISIONES.md` antes de ampliar esas entidades.

## Requisitos no funcionales

- **RNF-01:** hay una aplicación web local; integración en el portal UCO pendiente.
- **RNF-02:** el catálogo es pequeño y local; no se declara verificada la meta de dos segundos en un despliegue real.
- **RNF-03:** se incluyen controles concretos de acceso, privacidad y tratamiento técnico. No se declara cumplimiento normativo certificado.

## Relación con la P4

Incluye código, pruebas y documentación para estudiar implementación. Los documentos no sustituyen vuestra memoria, matrices revisadas, manual final, vídeo, plantillas de pruebas ni registros reales del equipo en GitHub/YouTrack/Trello. El stack corresponde a la petición del usuario, no cambia las herramientas prescritas por la asignatura.
