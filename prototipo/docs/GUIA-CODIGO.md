# Guía para leer y modificar el código

## Primera vuelta: 30–45 minutos

1. Arranca el servidor y entra como investigación UCO. Abre catálogo y crea una reserva para la balanza.
2. Lee `src/model.ts`: identifica `User`, `Instrument`, `Booking` y `BookingInput`.
3. Lee `public/index.html`: solo carga la hoja de estilo y el módulo de entrada.
4. Busca `bookingDialog` y `bookingInput` en `public/app.ts`: observa cómo se construye el formulario y su petición.
5. Busca `/api/bookings` en `src/server.ts`: sigue la identidad autenticada y el JSON recibido.
6. Lee `createBooking` y `plan` en `src/system.ts`: enumera las reglas en orden.
7. Lee `transaction` y la tabla `bookings`: localiza qué garantiza el código y qué garantiza SQL.
8. Busca los casos «Prioridad» y «Atomicidad» en `tests/system.test.ts`.

## Dónde cambiar cada cosa

| Quiero… | Empiezo en… | Verifico con… |
| --- | --- | --- |
| Cambiar colores, espacios o móvil | `public/styles.css` | Navegador a 1440 y 390 px |
| Cambiar el contenido de una pantalla | `public/views.ts` | La pantalla correspondiente |
| Añadir un campo al formulario | `public/app.ts` | Formulario, petición y validación |
| Cambiar el horario permitido | `src/time.ts` | Pruebas de reservas y límites |
| Cambiar prioridad UCO | `src/system.ts`, método `plan` | Tres casos de más/igual/menos de siete días |
| Añadir una operación | `src/system.ts`, después `server.ts` | Prueba de negocio y HTTP |
| Cambiar datos iniciales | `src/seed.ts` | Nueva BD de demostración |
| Guardar un campo nuevo | `schema.sql` y tipos | Nueva BD o migración explícita |
| Añadir un perfil | `model.ts`, esquema, permisos y vistas | Intentos permitidos y denegados |

## Cómo ampliar una historia

Escribe primero los criterios que deben cumplirse y elige una operación del módulo. Mantén la validación real en el servidor. La interfaz puede ayudar con valores por defecto y mensajes, pero se puede llamar a HTTP sin usar el formulario.

Ejemplo: introducir un tiempo máximo por reserva requiere una decisión de requisitos. Si se aprueba, añádelo a `validateSlot`, escribe un caso justo en el límite y otro por encima, adapta los mensajes y actualiza el manual. Cambiar solo el atributo `max` del HTML dejaría abierta otra entrada por HTTP.

## Cómo construir una prueba

Una prueba crea una base en memoria y datos ficticios. Su reloj es fijo. Ejecuta una operación pública y comprueba un efecto observable: una reserva rechazada, un estado, la asignación de técnico o un aviso. Evita comprobar únicamente que existe una función o que devuelve algo.

Para depurar un caso concreto:

```bash
node --test --test-isolation=none --test-name-pattern="exactamente siete" tests/system.test.ts
```

No avances el reloj dejando una sesión de ejemplo «en uso» si quieres que el técnico esté libre. El sistema bloquea otra sesión real hasta que se registre su finalización: es una regla deliberada, no una limpieza automática.

## Qué conviene estudiar después

Chequeo estático con `tsc` y tipos de Node; migraciones de base; autenticación institucional; adaptador real de correo; pruebas de concurrencia entre procesos; registro operativo; zonas horarias y calendarios laborales. Son ampliaciones identificadas, no funcionalidades que el prototipo afirme tener.
