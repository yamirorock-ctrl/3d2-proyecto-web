# 🤖 Configuración del Asistente con IA (Gemini)

El asistente de chat ya está implementado y listo para usar. Solo necesitas configurar tu API key de Google Gemini.

## 📝 Pasos para configurar Gemini AI:

### 1️⃣ Obtener tu API Key GRATIS

1. Ve a: **https://aistudio.google.com/app/apikey**
2. Inicia sesión con tu cuenta de Google
3. Haz clic en **"Create API Key"**
4. Copia la clave que te genera

### 2️⃣ Configurar en tu proyecto

1. Abre el archivo `.env.local` en la raíz del proyecto
2. Reemplaza `TU_API_KEY_AQUI` con tu API key:

```env
VITE_GEMINI_API_KEY=AIzaSy...tu_key_real_aqui
```

3. Guarda el archivo
4. **Reinicia el servidor** (detén con Ctrl+C y vuelve a ejecutar `npm run dev`)

### 3️⃣ Probar el asistente

1. Abre tu aplicación en el navegador
2. Busca el botón flotante del chat (esquina inferior derecha)
3. Haz clic y pregunta algo como:
   - "¿Qué productos tienen disponibles?"
   - "Necesito un regalo para mi novio"
   - "¿Hacen envíos?"

## ✨ Características del asistente:

- **Conoce tu catálogo**: Puede recomendar productos según lo que busques
- **Explica tecnologías**: Te cuenta sobre impresión 3D y corte láser
- **Sugiere personalizaciones**: Te ayuda a crear productos únicos
- **Responde en español**: Tono amigable y moderno
- **Usa emojis**: Para hacer la conversación más cercana

## 🔒 Seguridad:

- La API key es **GRATUITA** (límite: 60 requests por minuto)
- No compartas tu key públicamente
- El archivo `.env.local` está en `.gitignore` (no se sube a GitHub)

## ⚠️ Notas importantes:

- Si no configuras la key, el asistente mostrará un mensaje indicándolo
- La key solo funciona en tu dominio después de configurarla en Google AI Studio
- Puedes limitar el uso de la API en el panel de Google AI Studio

---

¡Listo! Con esto tu asistente estará funcionando perfectamente 🚀
