// Nombres y URL de los medios del proyecto (compartido entre el proceso principal y el renderer).

/** Origen del protocolo propio con el que se sirven la interfaz y los medios. */
export const APP_ORIGIN = 'app://dra-wings';

/** Extensión canónica de cada tipo MIME admitido. */
export const MEDIA_EXT_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/flac': 'flac',
  'audio/aac': 'aac',
};

/** Nombre de un medio dentro del proyecto y de la caché: `<sha256>.<ext>`. */
export const MEDIA_NAME = /^([0-9a-f]{64})\.(png|jpg|webp|gif|mp3|wav|ogg|m4a|flac|aac)$/;

export function mediaFileName(hash: string, mime: string): string | null {
  const ext = MEDIA_EXT_BY_MIME[mime];
  return ext && /^[0-9a-f]{64}$/.test(hash) ? `${hash}.${ext}` : null;
}

export function mediaUrl(hash: string, mime: string): string | null {
  const name = mediaFileName(hash, mime);
  return name ? `${APP_ORIGIN}/media/${name}` : null;
}
