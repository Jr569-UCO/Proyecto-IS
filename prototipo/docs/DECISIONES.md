# Decisiones y límites de la demostración

Este documento diferencia las reglas de vuestra P2 de las decisiones adoptadas para poder ejecutar un ejemplo. No registra acuerdos nuevos con el cliente.

| Tema | Decisión del prototipo | Implicación |
| --- | --- | --- |
| Tecnología | TypeScript, HTML, CSS y módulos incluidos en Node | Sigue la petición de este chat; no ejemplifica Eclipse/CUTE/C++ |
| Datos | SQLite local con semilla relativa al primer arranque | Persiste; las fechas no se desplazan automáticamente cada día |
| Moodle, RF-02 | Cuentas UCO locales de demostración | Integración institucional pendiente |
| Correo, RF-14/RF-23 | Notificaciones persistentes por destinatario | Envío SMTP pendiente; ningún mensaje sale del equipo |
| Exactamente siete días, P-02 | La reserva externa queda protegida | Solo se desplaza cuando faltan estrictamente más de 168 horas |
| Prioridad, P-03 | UCO desplaza únicamente experimentos externos futuros confirmados | Nunca desplaza UCO, mantenimiento ni uso iniciado |
| Intervalos | `[inicio, fin)` | Las franjas consecutivas son compatibles |
| Antelación de cancelación | Al menos 24 horas es gratis | A 23 h 59 min se registra duración prevista facturable |
| Contrato | Debe estar vigente al acceder y cubrir el fin de la nueva reserva | Fin del contrato inclusivo hasta 23:59:59.999 del día indicado |
| Sala, P-04 | Se reserva el instrumento | Se permite compartir sala usando equipos distintos |
| Mantenimiento, P-06 | Rechazar la franja incompatible | Conserva citas anteriores; no decide desplazarlas |
| Técnicos | Dos perfiles de ejemplo, disponibles 08–20 mientras no tengan otra reserva | No hay festivos, turnos, bajas ni especialidades por instrumento |
| Asignación técnica | Primer técnico activo libre por identificador | No incluye optimización de cargas |
| Equipos autónomos | El administrador puede registrar su uso real | No se asigna técnico a una reserva que no lo requiere |
| Uso real | Solo se inicia durante la franja prevista; puede finalizar después | El técnico debe cerrar la sesión; mientras tanto impide otro uso real incompatible |
| Avería | Conserva citas, bloquea nuevas reservas y genera avisos | Los afectados deben revisar el estado; no se inventa una recolocación automática |
| Varias incidencias | Solo la última resolución devuelve el equipo a disponible | Evita liberar un aparato que todavía tiene una avería abierta |
| Informes | Solo usos finalizados; recorte al mes en Madrid; horas separadas | Las cancelaciones tardías pertenecen al mes de la sesión prevista |
| Tarifas, P-01/P-05 | No se asignan importes ni se cobran pagos | Se exportan horas para el proceso contable |
| Consulta, P-07 | Lectura del catálogo, ocupación, incidencias y contacto | No crea reservas ni modifica recursos |
| Privacidad | Investigación/consulta no recibe identidad, entidad ni motivo de reserva ajena | Administración, técnicos y contabilidad conservan acceso operativo |
| Registro | Solo administración crea cuentas externas | No hay autorregistro público ni recuperación de contraseña |
| Contacto | Dirección ficticia con dominio `.invalid` | Debe sustituirse por el contacto oficial |
| Idioma | Español para estudiar el ejemplo | Revisar idioma de la entrega final; la P2 menciona documentación en inglés |

## Lo que aún hace falta para una entrega o un despliegue real

La app no se integra en el portal UCO, no autentica contra Moodle, no envía correo, no gestiona turnos ni tarifas y no certifica RGPD/IPS. La documentación no se presenta como evaluación de cumplimiento. El tiempo de carga no se ha certificado bajo condiciones de producción.

Tampoco hay gestión completa del inventario, edición de todas las reservas, recuperación de contraseñas, despliegue TLS o migraciones de esquema. Las credenciales de demostración son públicas. El servidor escucha solo en loopback.

`check.ts` verifica que el código se puede transformar y construir; no ofrece un resultado de chequeo estático. Para añadirlo, instala TypeScript y los tipos de Node en tu entorno de desarrollo, configura `tsc --noEmit` con resolución NodeNext y revisa por separado las bibliotecas DOM del navegador.

## Relación con la práctica 4

La P4 propone C++/Eclipse/CUTE. Este prototipo utiliza la tecnología pedida posteriormente por el usuario para aprender y explorar la implementación. La aceptación de otra tecnología en la entrega académica corresponde al profesor; el ejemplo no modifica el enunciado.
