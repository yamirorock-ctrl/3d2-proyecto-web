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

### 1. 🤖 IA & UX (Printy & Chat) - ✅ FINALIZADO

- **Avatar "Printy":** Implementado personaje de marca con diseño de alto contraste (fondo blanco, borde índigo) y animaciones.
- **Personalidad:** El Chatbot Web y el Webhook de MercadoLibre ahora comparten la personalidad "Printy" (Alegre, emojis, servicial).

### 2. ⚡ MercadoLibre Webhook (Respuestas Automáticas) - ✅ FINALIZADO

- **Reparación:** Habilitado el scope `questions` (que estaba oculto en la UI) y validado flujo completo.
- **Motor IA:** Actualizado a **Gemini 3.0 Flash Preview** (Modelo 2026, más rápido y capaz).
- **Rendimiento:** Implementada carga paralela (`Promise.all`) de Item + Stock para evitar timeouts en Vercel.
- **Resiliencia:** El bot responde instantáneamente.

### 3. 🛡️ Infraestructura & Mantenimiento - ✅ FINALIZADO

- **Refresh Token Automático:** Creado script `api/cron-refresh-ml.js` y configurado **Cron Job** en `vercel.json` (Ejecución horaria).
  - _Resultado:_ El token de MercadoLibre se renueva solo, evitando que el bot deje de responder cada 6hs.

### 4. 🛍️ Google Merchant Center

- **Estado:** ✅ Feed configurado y productos en revisión.

---

## 🛠️ ARQUITECTURA TÉCNICA (CAMBIOS RECIENTES)

### Archivos Clave Modificados:

- **`components/ChatAssistant.tsx`:** Lógica de avatar, estilos y manejo de errores.
- **`api/ml-webhook.js`:** Lógica central de respuestas ML (Optimización paralela + Prompt Printy).
- **`api/cron-refresh-ml.js`:** Nuevo endpoint para mantenimiento de tokens.
- **`vercel.json`:** Configuración de Cron Jobs.

---

## ⚠️ TAREAS PENDIENTES (PRÓXIMA SESIÓN)

### 1. 🤖 Automatización Make.com (Instagram -> Pinterest)

Hemos detectado errores de configuración que deben corregirse mañana:

- **Loop Infinito:** El módulo de Instagram lee posts antiguos. _Solución:_ Configurar "Choose where to start: From now on / Manual".
- **Fotos Duplicadas:** Al subir carruseles, se sube 7 veces la misma foto. _Solución:_ Corregir mapeo del **Iterador** (usar variable de iterador, no del array padre).
- **Error de Largo:** Descripciones >800 caracteres rompen Pinterest. _Solución:_ Usar fórmula `substring(text;0;500)`.

### 2. 📹 Verificación Google Business

(Pendiente externa: esperar a que Google valide el video).

### 3. ✅ Revisión de Productos:

- Esperar 24-48hs a que Google Merchant apruebe los 38 productos (pasar de azul a verde).

### 4. 🔍 Monitorización:

- Revisar que Make no de errores en el módulo de Google (se le puso "Ignore Error" temporalmente).

---

### 5. ⚖️ Discusión de Arquitectura (Flujo Híbrido)

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
