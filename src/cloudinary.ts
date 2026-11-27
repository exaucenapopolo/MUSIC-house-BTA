const DEFAULT_CLOUD_NAME = 'do83voiqy';
const DEFAULT_UPLOAD_PRESET = 'afrikdigitalo_upload';
export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || DEFAULT_CLOUD_NAME;
export const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || DEFAULT_UPLOAD_PRESET;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function isValidStudioAvatarUrl(value: string): boolean {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com'
      && url.pathname.startsWith('/' + CLOUDINARY_CLOUD_NAME + '/image/upload/');
  } catch {
    return false;
  }
}

export async function uploadArtistAvatar(file: File): Promise<string> {
  if (!file || !Number.isFinite(file.size) || file.size <= 0) throw new Error('Sélectionnez une image valide.');
  if (file.size > MAX_AVATAR_BYTES) throw new Error('La photo ne doit pas dépasser 5 Mo.');
  const form = new FormData();
  form.append('file', file, file.name || 'music-house-avatar');
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  form.append('folder', 'music-house-bta/avatars');
  const response = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload', {
    method: 'POST', body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.resource_type !== 'image' || !isValidStudioAvatarUrl(result.secure_url)) {
    throw new Error(result.error && result.error.message || 'Cloudinary n’a pas pu enregistrer cette image. Vérifiez le preset de téléversement.');
  }
  return result.secure_url;
}
