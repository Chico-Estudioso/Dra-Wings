# Cómo probar Dra-Wings

Guía para instalar una versión de prueba en Windows y repasar lo que conviene comprobar a mano (lo
que las pruebas automáticas no pueden ver: el oído, la tableta, el reproductor de vídeo de Windows).

## 1. Instalarla

### Versión portable (sin instalar)

1. Descomprime `Dra-Wings-0.1.0-win-x64.zip` (clic derecho → **Extraer todo**). No la ejecutes desde
   dentro del zip.
2. En la carpeta extraída, abre **`Dra-Wings.exe`**.
3. La aplicación **no está firmada**, así que Windows SmartScreen puede avisar («Windows protegió su
   PC»): pulsa **Más información** y luego **Ejecutar de todas formas**. Es normal en una versión de
   prueba sin certificado de firma (ver `docs/PACKAGING.md`).

La versión portable es la misma aplicación que la instalada, pero no crea accesos directos ni abre
los `.dwings` con doble clic (ábrelos desde **Abrir** o arrastrándolos a la ventana). Para quitarla,
borra la carpeta. Los recientes y la recuperación se guardan en `%APPDATA%\Dra-Wings`.

### Con el instalador

El instalador (`Dra-Wings-0.1.0-instalador.exe`) se construye en Windows con `npm run dist:win` (ver
abajo). Crea accesos directos, asocia los `.dwings` y no pide permisos de administrador; SmartScreen
avisará igual que con la versión portable. Para quitarlo: «Configuración → Aplicaciones → Dra-Wings →
Desinstalar» (tus proyectos y `%APPDATA%\Dra-Wings` no se borran).

### Desde el código (alternativa)

Si prefieres construirla tú mismo en Windows: instala [Node.js 22](https://nodejs.org) y
[Git](https://git-scm.com), y en una terminal:

```bash
git clone https://github.com/Chico-Estudioso/Dra-Wings.git
```

```bash
cd Dra-Wings
```

```bash
npm ci
```

```bash
npm run dev
```

`npm run dev` abre la aplicación directamente. Para generar el instalador en `dist\` usa
`npm run dist:win` (no publica nada).

## 2. Primeros pasos

- En el inicio, **Ver un ejemplo** abre un proyecto de tres escenas que enseña las herramientas:
  cielo en degradado, textos que se escriben solos, zoom de cámara, transiciones, un personaje que
  cambia de expresión y salta, letras con contorno y sombra, y estrellas que saltan en ola. Pulsa
  **Reproducir** (o Intro) y luego cambia lo que quieras.
- **?** o **F1** muestran todos los atajos.

## 3. Qué probar

Marca lo que funcione y apunta lo que no (qué hiciste, qué esperabas y qué pasó).

**Dibujar**
- [ ] Lápiz con ratón y, si tienes, con tableta (presión). Pinceles: rotulador, lápiz y tiza.
- [ ] Ayudas: estabilizador, tinta, formas rápidas (dibuja un círculo y deja el puntero quieto) y
      espejo (arrastra el punto del eje).
- [ ] Bote de pintura (G): rellena un dibujo cerrado, uno con un hueco pequeño y el cielo sobre un
      horizonte. Vuelve a hacer clic en un relleno para cambiarle el color.
- [ ] Colores personalizados: aparecen después en «recientes» en todas las paletas.

**Animar**
- [ ] Animaciones rápidas (saltar, balancearse…), animar arrastrando y repetir movimiento.
- [ ] Copiar animación de un elemento y pegarla en varios, a la vez y en ola.
- [ ] Vida automática, elasticidad, trazo vivo y mano que dibuja (al reproducir).
- [ ] Cámara: encuadre, zoom y «Seguir con la cámara» a un personaje.
- [ ] Transiciones entre escenas y fondo por escena (liso o degradado).

**Videoclip**
- [ ] Importa una canción en la pista de música: se detecta el ritmo (golpes en la regla).
- [ ] Guion rápido con la letra (una escena por línea), con «Letras con contorno blanco y sombra».
- [ ] Reproduce y pulsa **M** en cada cambio de frase; al parar, «Ajustar las escenas a las marcas».
      ¿Caen las frases donde las oyes? Pruébalo también con auriculares Bluetooth.
- [ ] Repetir la escena (botón de bucle) mientras pules una escena al ritmo.
- [ ] Efectos de sonido (menú Audio).

**Voz**
- [ ] Graba la narración con el micrófono (también mientras se reproduce el vídeo).
- [ ] Un personaje con «Habla con la narración» mueve la boca con tu voz.

**Guardar y exportar**
- [ ] Guarda, cierra y vuelve a abrir (también con doble clic en el `.dwings`).
- [ ] Exporta el vídeo a 1080p y reprodúcelo en «Películas y TV» y en VLC: colores, sonido
      sincronizado y duración.
- [ ] Guarda un fotograma como imagen (Ctrl+Mayús+E).
- [ ] Cierra la aplicación a la fuerza con cambios sin guardar y vuelve a abrirla: ofrece recuperar.

**Pantalla**
- [ ] En una pantalla de portátil (1366 × 768 o 1024 × 768) todo cabe y se puede usar.

## 4. Si algo falla

Cuéntalo en el chat o abre una incidencia en GitHub con los pasos para repetirlo y, si puedes, el
proyecto `.dwings` y una captura. Los datos de la aplicación (recientes, recuperación y caché de
medios) están en `%APPDATA%\Dra-Wings`; no hace falta borrarlos para reinstalar.
