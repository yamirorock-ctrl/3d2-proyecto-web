// Cloudinary client-side upload
// Requires env vars: VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET

export async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = (import.meta as any).env?.VITE_CLOUDINARY_CLOUD_NAME;
  const preset = (import.meta as any).env?.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset) throw new Error('Cloudinary no configurado (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET)');

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', preset);

  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Falló subida a Cloudinary');
  const data = await res.json();
  if (!data.secure_url) throw new Error('Respuesta inválida de Cloudinary');
  return data.secure_url as string;
}
