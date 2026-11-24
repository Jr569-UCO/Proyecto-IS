# Manual de usuario

## Preparación

Ejecuta `node src/server.ts` desde `prototipo/` y abre http://localhost:4173. Selecciona un perfil de demostración. También puedes escribir las cuentas del README; todas usan `Demo2026!`.

La aplicación muestra la hora del centro en Madrid. Los datos se guardan en una base local. Cambiar de perfil no borra reservas ni incidencias.

## Investigación: reservar un equipo

1. Entra con `uco@demo.local` o `externa@demo.local`.
2. Abre **Instrumentos**. Usa el buscador y los filtros de técnica.
3. Pulsa **Reservar** en un equipo operativo.
4. Selecciona un día futuro, inicio y fin entre 08:00 y 20:00 y un motivo de al menos cinco caracteres.
5. Pulsa **Comprobar disponibilidad**. Si no hay técnico o la franja está ocupada, aparece el motivo.
6. Pulsa **Confirmar reserva**. La comprobación se repite antes de guardarla.
7. Consulta **Reservas → Mis reservas** y tu bandeja de notificaciones.

Elige una franja distinta si aparece un conflicto. Puedes reservar instrumentos diferentes de una misma sala; el sistema comprueba por separado los técnicos cuando son necesarios.

## Probar la prioridad UCO

Al crear la base se añade una reserva externa del microscopio para diez días después, de 10:00 a 12:00. Localiza su fecha en **Reservas**. Entra como UCO y solicita esa misma franja.

Si todavía faltan más de siete días, se confirma la nueva cita y la externa pasa a **Desplazada**. Entra después con `externa@demo.local` para ver el aviso. A siete días exactos o menos, se conserva la reserva externa. Las fechas iniciales no se actualizan cada vez que arranca el servidor.

## Cancelar una reserva

En **Mis reservas**, pulsa **Cancelar** en una cita futura confirmada. El diálogo informa si es gratuita o si se registrará como facturable. Confirma para liberar la franja. Solo administración puede cancelar citas de otras personas.

No se puede cancelar una sesión ya iniciada ni una reserva que ya ha comenzado. No se realizan cobros: solo se guarda el dato para contabilidad.

## Comunicar y reparar una avería

1. Investigación, técnicos o administración abren **Incidencias → Comunicar incidencia**.
2. Seleccionan el instrumento y escriben una descripción de al menos diez caracteres.
3. Al guardar, el equipo queda averiado y se generan avisos para las personas con sesiones afectadas. Las citas no desaparecen.
4. Un técnico o administrador pulsa **Registrar reparación** y explica el trabajo realizado.
5. Si ya no quedan otras incidencias abiertas del equipo, vuelve a estar disponible.

La centrífuga empieza con una incidencia para que puedas probar una reparación inmediatamente.

## Personal técnico: mantenimiento y uso real

Con `tecnico@demo.local`, abre **Reservas → Mantenimiento**. Elige instrumento, fecha y horario. La franja debe estar libre y el mantenimiento ocupa al técnico que lo programa. También se puede programar para un aparato averiado; programarlo no equivale a repararlo.

Para una reserva de experimento asignada a tu perfil, aparece **Iniciar uso** cuando llega su franja. **Finalizar uso** guarda el fin real y permite incluirla en el informe. No inventa horas ni permite elegir una fecha de cierre pasada. Si no se cierra una sesión, el instrumento/técnico sigue teniendo un uso real en curso.

Cuando el primer arranque se realiza entre 08:00 y 20:00, existe una sesión de ejemplo en curso para el primer técnico; puedes finalizarla sin esperar. En los equipos sin supervisión, el administrador registra el uso real en esta demostración.

## Administración: usuarios y contratos

En **Usuarios y contratos**, pulsa **Alta de cuenta externa**. Introduce nombre, correo, entidad, contraseña de al menos diez caracteres y fechas del contrato. Después puedes cerrar sesión y acceder con la nueva cuenta.

**Editar contrato** permite ampliar o reducir la vigencia y habilitar/deshabilitar la cuenta. Guardar invalida sus sesiones abiertas. Las cuentas con contrato vencido no pueden acceder. La cuenta `caducado@demo.local` permite comprobar ese caso.

## Contabilidad: informe y CSV

Entra como contabilidad o administración. Abre **Informes de consumo** y selecciona el mes. El informe agrupa persona e instrumento, separando horas reales y duración prevista de cancelaciones tardías.

**Exportar CSV** descarga las mismas filas para abrirlas con una hoja de cálculo. Se utiliza punto y coma como separador. Las sesiones de ejemplo finalizadas están uno y dos días antes del primer arranque; si quedan en el mes anterior, selecciónalo. Las sesiones en curso no se cuentan hasta finalizarlas.

## Notificaciones y ayuda

La campana abre la bandeja del perfil actual. **Marcar todo como leído** elimina sus indicadores de novedad. Los avisos representan correos simulados; ningún mensaje se envía fuera del equipo.

**Documentación** abre la guía de implementación y sus documentos. **Contacto del centro** muestra datos ficticios identificados como tales.

## Errores frecuentes

| Mensaje o síntoma | Acción |
| --- | --- |
| No conecta con el servidor | Mantén abierta la terminal con `node src/server.ts` |
| Puerto ocupado | Cambia `PORT` o detén la instancia anterior |
| Sesión/formulario caducado | Recarga y vuelve a acceder |
| Contrato no vigente | Administración debe actualizarlo |
| No hay técnico disponible | Elige otra franja o revisa las sesiones activas |
| Instrumento averiado | Espera a que se registren todas las reparaciones |
| Franja protegida | Consulta otra hora; las reglas no permiten desplazar esa reserva |
| No aparecen cambios al tocar `seed.ts` | La semilla solo se aplica a una base vacía; reinicia la demo con copia |

## Reiniciar los datos

Detén el servidor. Ejecuta `node scripts/reset.ts --confirmar`. El script guarda una copia de la base en `data/backups/` y genera de nuevo las cuentas y fechas ficticias. Arranca otra vez y entra con un perfil. No uses esta operación sobre datos reales.
