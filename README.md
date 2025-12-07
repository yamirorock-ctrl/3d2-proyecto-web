<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1eFLhwy0xObo-EYMLczbj1byFbfFUT-l6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Configuración de Entorno (.env)

Crea un archivo `.env.local` (o `.env`) en la raíz con las siguientes variables:

```
GEMINI_API_KEY=tu_clave_gemini
VITE_CLOUDINARY_CLOUD_NAME=tu_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=tu_upload_preset_unsigned
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_TOKEN=tu_anon_key
VITE_SUPABASE_BUCKET=images
```

Agrega también la clave pública de Mercado Pago si usarás su checkout:

```
VITE_MP_PUBLIC_KEY=tu_public_key_mp
```

### Cloudinary
1. Crear cuenta en Cloudinary.
2. Ir a Settings > Upload > Add upload preset.
3. Marcar como unsigned (Unsigned mode) para permitir uploads directos desde el navegador.
4. Guardar el nombre del preset en `VITE_CLOUDINARY_UPLOAD_PRESET` y tu cloud name en `VITE_CLOUDINARY_CLOUD_NAME`.
5. (Opcional) Limitar formatos permitidos y tamaño máximo desde la configuración del preset.

### Supabase Storage
1. Crear proyecto en Supabase y obtener `URL` y `anon key` (Settings > API).
2. Ir a Storage > Crear bucket llamado `images` (o el que prefieras).
3. Activar acceso público (Public bucket) para servir imágenes sin token.
4. Añadir las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_TOKEN` y opcionalmente `VITE_SUPABASE_BUCKET`.
5. El botón "Probar Supabase" en el panel Admin permite validar upload/delete (permiso correcto).

Si deseas políticas más estrictas, evita público y crea un endpoint backend firmado (no incluido aquí).

### Mercado Pago (Checkout)
1. Crea cuenta en Mercado Pago y obtiene tu Public Key (NO usar access token aquí).
2. Añade `VITE_MP_PUBLIC_KEY` al `.env.local`.
3. Implementa un backend (Node/Serverless) que cree preferencias vía API usando tu access token secreto. Endpoint sugerido: `/api/mp/preference`.
4. El frontend solicita ese endpoint enviando los items (id, title, quantity, unit_price) y recibe `preferenceId`.
5. SDK JS (`https://sdk.mercadopago.com/js/v2`) inicializa `MercadoPago(publicKey)` y abre checkout (redirect o modal).

Mientras no exista backend, el botón mostrará advertencia. No coloques el access token en el cliente: solo se usa para crear la preferencia del lado seguro.

### Flujo de Imágenes
| Destino        | Uso | Pros | Contras |
|----------------|-----|------|---------|
| IndexedDB Local | Rápido prototipado | No requiere cuenta externa | Se borra al limpiar datos / limitado por navegador |
| Cloudinary      | Producción recomendada | CDN optimizaciones, transformación | Necesita preset y límites configurados |
| Supabase        | Integración con base de datos | Control desde una sola plataforma | Necesita gestión de bucket y políticas |

### Validación de URLs
Al agregar imágenes por URL, el panel hace: validación de extensión, HEAD (content-type) y un GET ligero con abort para detectar problemas de CORS. Si falla, se muestra placeholder y badge de error.

### Copia de Seguridad
Usa "Exportar Backup" en Admin para descargar JSON de productos, categorías y órdenes. "Importar Backup" permite restaurar.

### Variables Faltantes
Si faltan variables de Supabase o Cloudinary y eliges ese destino, se alerta antes de subir.

### Scripts
```
npm install        # Instala dependencias
npm run dev        # Arranca entorno desarrollo
npm run build      # Construye para producción
```

### Deploy en GitHub Pages
Si usas GitHub Pages y `base` en Vite (ej: `/3d2-proyecto-web/`), asegúrate de usar rutas relativas con `import.meta.env.BASE_URL` para assets (`logo.svg`, `placeholder.svg`). Las imágenes en IndexedDB sólo persisten en el navegador del cliente; usa Cloudinary o Supabase para persistencia real.

