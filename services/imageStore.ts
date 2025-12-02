import localforage from 'localforage';

const store = localforage.createInstance({
  name: '3d2-store',
  storeName: 'images'
});

const urlCache = new Map<string, string>();

function randomId(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function saveFile(file: File | Blob): Promise<string> {
  const key = `img-${Date.now()}-${randomId()}`;
  await store.setItem<Blob>(key, file);
  return key;
}

export async function saveDataUrl(dataUrl: string): Promise<string> {
  // Convert dataURL to Blob via fetch
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return saveFile(blob);
}

export async function getBlob(key: string): Promise<Blob | null> {
  try {
    const blob = await store.getItem<Blob>(key);
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function getUrl(key: string): Promise<string | null> {
  if (urlCache.has(key)) return urlCache.get(key)!;
  const blob = await getBlob(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

export function revokeUrl(key: string) {
  const url = urlCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(key);
  }
}

export async function remove(key: string): Promise<void> {
  revokeUrl(key);
  await store.removeItem(key);
}
