import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  initialQuality?: number;
}

/**
 * Comprime una imagen a formato WebP con opciones configurables
 * @param file - Archivo de imagen a comprimir
 * @param options - Opciones de compresión
 * @returns Promise con el archivo comprimido
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const defaultOptions = {
    maxSizeMB: 0.5, // Máximo 500KB
    maxWidthOrHeight: 1920, // Máximo 1920px de ancho o alto
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8, // 80% de calidad
  };

  const compressionOptions = { ...defaultOptions, ...options };

  try {
    console.log('Original file:', {
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: file.type,
    });

    const compressedFile = await imageCompression(file, compressionOptions);

    console.log('Compressed file:', {
      name: compressedFile.name,
      size: (compressedFile.size / 1024 / 1024).toFixed(2) + ' MB',
      type: compressedFile.type,
      reduction: (((file.size - compressedFile.size) / file.size) * 100).toFixed(1) + '%',
    });

    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('No se pudo comprimir la imagen');
  }
}

/**
 * Convierte un archivo de imagen a base64
 * @param file - Archivo de imagen
 * @returns Promise con la cadena base64
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime una imagen y la convierte a base64
 * @param file - Archivo de imagen a comprimir
 * @param options - Opciones de compresión
 * @returns Promise con la cadena base64 de la imagen comprimida
 */
export async function compressImageToBase64(
  file: File,
  options: CompressionOptions = {}
): Promise<string> {
  const compressedFile = await compressImage(file, options);
  return fileToBase64(compressedFile);
}
