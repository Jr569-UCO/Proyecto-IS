# Operaciones HTTP

La aplicación sirve HTML y recursos en el mismo origen que `/api`. Las respuestas del sistema son JSON, salvo la exportación CSV. Todos los cambios usan `POST` con `Content-Type: application/json`, cookie de sesión y cabecera `X-CSRF-Token`. El acceso es la única operación de escritura que no necesita sesión previa.

## Rutas

| Método y ruta | Acceso | Entrada / resultado |
| --- | --- | --- |
| `GET /health` | Público | `{ "ok": true }` |
| `POST /api/login` | Público, con límite de intentos | `email`, `password`; devuelve `user`, `csrf` y cookie |
| `GET /api/session` | Sesión vigente | Persona y token CSRF |
| `POST /api/logout` | Sesión | `{}`; invalida la sesión |
| `GET /api/state` | Sesión | Estado adaptado a los permisos del perfil |
| `POST /api/availability` | Investigación/admin o mantenimiento técnico | Instrumento, fecha/hora y tipo; sin mutaciones |
| `POST /api/bookings` | Investigación/admin | Reserva de experimento; devuelve `id` |
| `POST /api/bookings` con `kind=mantenimiento` | Técnico/admin | Mantenimiento; devuelve `id` |
| `POST /api/bookings/:id/cancel` | Propietario o admin | `{}`; devuelve `billable` |
| `POST /api/bookings/:id/start` | Técnico asignado/admin | `{}`; registra inicio real |
| `POST /api/bookings/:id/finish` | Técnico asignado/admin | `{}`; registra fin real |
| `POST /api/incidents` | Investigación/técnico/admin | `instrumentId`, `description`; devuelve `id` |
| `POST /api/incidents/:id/resolve` | Técnico/admin | `resolution` |
| `POST /api/users` | Admin | Alta externa; devuelve `id` |
| `POST /api/users/:id/contract` | Admin | Fechas del contrato y `active` booleano |
| `POST /api/notifications/read` | Sesión | `{}`; marca los avisos propios |
| `GET /api/reports?month=AAAA-MM` | Contabilidad/admin | Filas de consumo mensual |
| `GET /api/reports.csv?month=AAAA-MM` | Contabilidad/admin | Descarga CSV con separador `;` y UTF-8 |

El administrador supera las restricciones de perfil, pero respeta horario, conflictos y estados de las operaciones. No se puede alterar una reserva enviando un `userId` inventado: la identidad procede de la sesión.

## Reserva de ejemplo

Las fechas siguientes son ilustrativas: selecciona un día futuro y dentro del contrato.

```json
{
  "instrumentId": 4,
  "startsAt": "2026-12-10T10:00",
  "endsAt": "2026-12-10T12:00",
  "purpose": "Preparación y pesaje de muestras",
  "kind": "experimento"
}
```

Son fechas locales de Madrid, no del huso del ordenador del visitante. El servidor guarda instantes numéricos en milisegundos. La disponibilidad acepta la misma estructura; no guarda nada.

## Alta externa de ejemplo

```json
{
  "name": "Persona de ejemplo",
  "email": "persona@example.invalid",
  "company": "Laboratorio de ejemplo",
  "password": "ClaveDeEjemplo2026!",
  "contractStart": "2026-11-01",
  "contractEnd": "2027-11-01"
}
```

No se permite elegir otro perfil al crear una cuenta externa. La contraseña se almacena con scrypt y una sal aleatoria. No se devuelve en el estado.

## Respuestas y errores

- `200`: operación o consulta correcta.
- `201`: recurso creado.
- `400`: formato, campo o regla de entrada inválidos.
- `401`: credenciales incorrectas, sesión ausente o caducada.
- `403`: perfil, contrato, origen o token CSRF no válidos.
- `404`: recurso u operación desconocidos.
- `409`: conflicto con una reserva o con el estado del recurso.
- `413`: cuerpo superior a 16 KiB.
- `415`: tipo de contenido distinto de JSON en una escritura.
- `429`: demasiados intentos de acceso en un minuto.
- `500`: error inesperado; se registra en la terminal y no expone SQL al navegador.

Los errores tienen forma `{ "error": "Mensaje legible" }`. El formulario conserva su contenido y muestra ese mensaje.

## Privacidad del estado

Para investigación/consulta, las reservas ajenas omiten nombre y entidad, ocultan el motivo y sustituyen su identificador de persona por cero. No se incluye el listado de usuarios ni resúmenes de contraseñas. El personal con permisos operativos puede ver los datos necesarios para trabajar. Los avisos son siempre los del destinatario autenticado.
