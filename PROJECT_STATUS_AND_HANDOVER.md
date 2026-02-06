# 🚀 ESTADO DEL PROYECTO: 3D2 - AUTOMATIZACIÓN E-COMMERCE

**Fecha de Actualización:** 05/02/2026 (05:25 AM)
**Objetivo:** Automatización total de Redes Sociales -> Ventas Web y Configuración Google.

---

## 🚨 REGLAS DE ORO (LEER ANTES DE TOCAR NADA) 🚨

1.  **PRODUCCIÓN ALWAYS:** Esta web **trabaja en PRODUCCIÓN**. No asumimos entornos locales de prueba desconectados. Los cambios impactan usuarios reales.
2.  **CEREBRO = SUPABASE:** Toda la información de productos, stock, y usuarios vive en **Supabase**. Es la FUENTE ÚNICA DE VERDAD.
3.  **FLUJO DE DESPLIEGUE:** Todo cambio se hace vía **Git** (`git push origin main`) -> dispara deploy en **Vercel**.
    - ❌ PROHIBIDO asumir que los archivos locales "se ven" mágicamente en la web sin git push.
    - ❌ PROHIBIDO usar datos hardcodeados que contradigan a Supabase.

---

## 🏆 LOGROS COMPLETADOS (SESIÓN HOY)

### 1. 🛍️ Google Merchant Center (Google Shopping)

- **Estado:** ✅ Configurado y Conectado.
- **Feed:** Automatizado via `api/feed.js`. Google lee los productos cada noche.
- **Estatus:** 38 Productos enviados. Actualmente en **"En revisión"** (tarda 24-48hs).
- **Verificación:** Sitio Web verificado con etiqueta HTML.

### 2. 🤖 Automatización Make.com (Instagram -> Web -> Pinterest/Google)

- **Estado:** ✅ FUNCIONANDO.
- **Flujo:**
  1.  **Trigger:** Detecta nueva foto en Instagram.
  2.  **Cerebro:** Llama a `api/find-link?q=palabra_clave` en la web.
  3.  **Acción 1 (Pinterest):** Publica el Pin con la foto y el **enlace directo de compra**.
  4.  **Acción 2 (Google Business):** Publica una "Novedad" con botón "Comprar" (Pendiente de verificación).
- **Prueba:** Exitosa. Se publicó un post de prueba y generó el enlace correcto.

### 3. 🧠 Mejora de Inteligencia Web

- **Búsqueda Inteligente (`api/find-link.js`):**
  - Antes: Buscaba coincidencia exacta (fallaba mucho).
  - Ahora: Sistema de **Puntaje por Palabras Clave**. Si buscas "Flexi", encuentra "Monito Flexi Articulado".
- **Ruteo Web (`Routes.tsx` + `Home.tsx`):**
  - Antes: Los links directos a productos (`/product/123`) daban error o página en blanco.
  - Ahora: Detectan el ID en la URL y **abren automáticamente el Modal del Producto** sobre la Home.

### 4. 📌 Pinterest & Legal

- **Pinterest:** Cuenta verificada (Meta tag instalada). Tablero conectado.
- **Legal:** Creada página de `Politica de Devolución` (`/politica-devolucion`) para cumplir con Google.

### 5. 🤖 IA & UX (Printy & Chat)

- **Avatar Personalizado:** Implementado **"Printy"** (Robot 3D Pixar-style) en el botón flotante y cabecera del chat.
  - Diseño estilo "burbuja flotante" (64px, borde blanco, sin fondo).
  - Manejo de errores: Si la imagen falla, vuelve al icono de impresora.
- **Tarjetas Visuales:**
  - Gemini ahora recibe URLs reales de imágenes e IDs de Supabase.
  - El chatbot muestra **Tarjetas de Producto** con foto, precio y botón que navega correctamente al detalle.
- **Identidad:** Migrado de "Asistente genérico" a "Printy, el experto de 3D2".

---

## 🛠️ ARQUITECTURA TÉCNICA (PARA LA IA)

### Archivos Clave Modificados:

- **`api/find-link.js`:** Algoritmo de búsqueda fuzzy para el bot de Make.
- **`components/Home.tsx`:** Lógica añadida para leer `useParams` y abrir `ProductDetailModal` si hay `productId`.
- **`Routes.tsx`:** Añadida ruta `product/:productId` apuntando a `Home`.
- **`index.html`:** Añadidas metaetiquetas de verificación (Google y Pinterest).
- **`api/ml-webhook.js`:** Webhook REAL de MercadoLibre (separado de `webhook.js` que es solo pagos).

### Flujo de Datos:

`Instagram Captions` -> `Make (HTTP Request)` -> `Web API (find-link)` -> `JSON { url: "..." }` -> `Make` -> `Pinterest/Google API`.

---

## ⚠️ TAREAS PENDIENTES (LO QUE FALTA)

1.  **📹 Verificación de Google Business:**
    - **EN PROCESO (5 Días):** El usuario ya realizó los pasos. Google está verificando la cuenta (tarda aprox 5 días).
    - _Hasta entonces, las publicaciones a Google Maps quedarán en pausa o pendientes._

2.  **✅ Revisión de Productos:**
    - Esperar 24-48hs a que Google Merchant apruebe los 38 productos (pasar de azul a verde).

3.  **🔍 Monitorización:**
    - Revisar que Make no de errores en el módulo de Google (se le puso "Ignore Error" temporalmente).

---

### 4. ⚖️ Discusión de Arquitectura (Flujo Híbrido)

- **Tema:** Definir si la "Fuente de Verdad" es la Web o Instagram.
- **Propuesta:** Tener ambos (Botón en Web + Automático en IG).
- **Prevención de Duplicados:** Usar un "Hashtag Llave" (ej: `#shop`) en Instagram para que Make SOLO replique esos posts, evitando spam si ya se subió desde la web.
- **Estado:** _En evaluación por el usuario._

---

## 💡 INSTRUCCIONES PARA LA PRÓXIMA SESIÓN

1.  Preguntar al usuario: _"¿Ya grabaste el video para Google?"_
2.  Si ya lo grabó: Revisar estado en `google.com/business`.
3.  Si NO lo grabó: Recordarle que es bloqueante para el SEO Local.
4.  Chequear Google Merchant Center para ver si hay productos rechazados y corregirlos.
