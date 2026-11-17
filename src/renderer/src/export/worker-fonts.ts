// Fuentes del texto dentro del worker de exportación: los mismos archivos que usa el editor
// (subconjuntos latin y latin-ext, suficientes para español y el resto de idiomas latinos).
import caveatExt from '@fontsource/caveat/files/caveat-latin-ext-400-normal.woff2?url';
import caveat from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url';
import nunitoExt from '@fontsource/nunito/files/nunito-latin-ext-400-normal.woff2?url';
import nunito from '@fontsource/nunito/files/nunito-latin-400-normal.woff2?url';
import handExt from '@fontsource/patrick-hand/files/patrick-hand-latin-ext-400-normal.woff2?url';
import hand from '@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2?url';

// Rangos de los subconjuntos de Google Fonts (idénticos a los de los CSS de @fontsource).
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const FACES: [family: string, url: string, range: string][] = [
  ['Patrick Hand', hand, LATIN],
  ['Patrick Hand', handExt, LATIN_EXT],
  ['Caveat', caveat, LATIN],
  ['Caveat', caveatExt, LATIN_EXT],
  ['Nunito', nunito, LATIN],
  ['Nunito', nunitoExt, LATIN_EXT],
];

export async function loadFonts(fonts: FontFaceSet): Promise<void> {
  await Promise.all(
    FACES.map(async ([family, url, unicodeRange]) => {
      const face = new FontFace(family, `url(${url})`, { unicodeRange });
      fonts.add(await face.load());
    }),
  );
}
