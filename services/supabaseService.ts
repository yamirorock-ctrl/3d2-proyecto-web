import { createClient } from '@supabase/supabase-js';

// 2. Usar una única instancia del cliente (patrón singleton) para toda la aplicación.
let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Obtiene una instancia única del cliente de Supabase.
 * Se añade la opción `db: { schema: 'public' }` para forzar la recarga del esquema
 * y evitar problemas de caché cuando la estructura de la base de datos cambia.
 */
export function getClient() {
  // Si el cliente ya fue creado, devolverlo.
  if (supabaseClient) {
    return supabaseClient;
  }

  // Si no, crearlo por primera vez.
  // Se leen las variables de entorno aquí dentro para asegurar que estén disponibles en el momento de la ejecución.
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonToken = import.meta.env.VITE_SUPABASE_ANON_TOKEN;

  if (!supabaseUrl || !supabaseAnonToken) {
    throw new Error('Supabase URL or Anon Token are not defined in environment variables.');
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonToken, {
    db: { schema: 'public' } // Esta opción ayuda a invalidar el caché del esquema.
  });

  return supabaseClient;
}

/**
 * Sube un archivo a un bucket de Supabase Storage.
 * @param file El archivo a subir.
 * @param bucket El nombre del bucket.
 * @param path La ruta opcional dentro del bucket.
 * @returns La URL pública del archivo subido.
 */
export async function uploadToSupabase(file: File, bucket: string, path?: string): Promise<string> {
  const client = getClient();
  const fileName = path || `${Date.now()}-${file.name}`.replace(/\s+/g, '-');
  const { error } = await client.storage.from(bucket).upload(fileName, file, { upsert: true });
  if (error) throw error;
  const { data } = client.storage.from(bucket).getPublicUrl(fileName);
  if (!data?.publicUrl) throw new Error('No se pudo obtener URL pública');
  return data.publicUrl;
}
