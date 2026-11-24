# Manual de construcción del SG-CICT

- **SG-CICT_Manual_completo_de_construccion.pdf**: libro maquetado con índice enlazado, guía por archivo y código íntegro numerado.
- **SG-CICT_Manual_completo_de_construccion.html**: la misma explicación y los listados seleccionables, sin numeración añadida al texto del código.
- **SG-CICT_fuentes_de_referencia.zip**: instantánea de los 32 archivos de texto de la aplicación y sus cinco capturas. No contiene bases de datos, sesiones ni copias.
- **manifest.json**: inventario, SHA-256, paginación e información de comprobación del documento.

Empieza por el capítulo «Cómo utilizar este libro» y trabaja en una carpeta de aprendizaje independiente. El código del anexo corresponde a los archivos del prototipo en el momento de generar el manual. Si los cambias después, conserva el ZIP como referencia de esta edición.

## Regenerar

`contenido_manual.py` contiene la explicación editorial. `generar_manual.py` extrae los listados, construye el índice en dos pasadas y genera PDF, HTML, ZIP y manifiesto.

Necesitas Python con Pycairo, PyGObject/Pango y Pygments disponibles en el entorno editorial. Estas herramientas no son necesarias para ejecutar el prototipo con Node.

```bash
python3 prototipo/manual/generar_manual.py
```

El generador solo lee los archivos fuente y las capturas. No abre SQLite ni arranca o detiene el servidor de la aplicación. Comprueba el ajuste de bloques en las páginas y la reconstrucción sin pérdida de las líneas partidas en el código.

La vista HTML enlaza las capturas desde `../docs/capturas/`; conserva su relación con la carpeta del prototipo. El PDF es autónomo.
