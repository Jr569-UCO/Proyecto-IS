# Propuesta de trabajo para el equipo

Esta es una propuesta para estudiar y evolucionar el prototipo. No es un registro de trabajo realizado por los integrantes ni debe presentarse como evidencia de sprints pasados.

## Reparto por recorridos

| Persona | Recorrido | Entregable completo |
| --- | --- | --- |
| José Raúl | Acceso, usuarios y contratos | Validación, pantalla, pruebas y documentación |
| Hugo | Catálogo, reservas, técnicos y prioridad | Operaciones, pantallas, casos límite y trazabilidad |
| Manuel | Incidencias, mantenimiento y avisos | Bloqueo/reparación, pantallas y pruebas |
| Equipo | Uso real, informes, integración y vídeo | Revisiones cruzadas y demostración conjunta |

El reparto sigue los diagramas de secuencia de vuestra P2. Conviene revisar juntos `model.ts` y `schema.sql` antes de editar campos compartidos.

## Sprints de la P4: calendario de las diapositivas

| Sprint | Fechas de 2026 | Producto que se podría revisar |
| --- | --- | --- |
| 1 | 16–22 noviembre | Esqueleto ejecutable, acceso y catálogo |
| 2 | 23–29 noviembre | Reservas con persistencia, horario y conflictos |
| 3 | 30 noviembre–6 diciembre | Técnicos, prioridad y cancelaciones |
| 4 | 7–13 diciembre | Incidencias, mantenimiento, uso e informes |
| 5 | 14–20 diciembre | Integración, correcciones, manuales y vídeo |

La entrega documental indicada en las diapositivas es el 21 de diciembre. No reconstruyáis retrospectivamente trabajo que no se haya realizado: planificad lo que queda con los datos reales del equipo.

## Cómo convertir una historia en tareas

Historia: «Como investigador quiero reservar un instrumento para realizar mi experimento».

| Tarea | Evidencia verificable |
| --- | --- |
| Acordar entradas y reglas | Criterios de aceptación y decisiones pendientes |
| Implementar `createBooking` | Operación probada con reloj fijo |
| Crear el formulario | Se puede reservar desde el navegador |
| Integrar permisos y errores | Investigación puede; consulta recibe denegación |
| Registrar pruebas | Entradas, esperado, obtenido, fallo y corrección |
| Actualizar manual y matriz | Enlaces a requisito, código y prueba |

Asignad responsable, prioridad y estimación en días a cada tarea. Rotad el Product owner y cerrad cada sprint con una revisión de una versión ejecutable. Los commits y tareas deben reflejar trabajo real y distribuido.

## Guion para el vídeo

1. Presentar el objetivo y mostrar el acceso por perfiles.
2. Consultar un instrumento y crear una reserva.
3. Repetir una franja para mostrar el rechazo.
4. Mostrar una asignación de técnico y un caso de prioridad UCO.
5. Abrir incidencia, comprobar bloqueo y registrar reparación.
6. Mostrar el uso real y el informe/CSV.
7. Indicar las integraciones simuladas y enseñar la documentación/pruebas.

El prototipo ofrece recorridos para grabarlo; no incluye un vídeo fingido ni una ejecución grabada automáticamente.
