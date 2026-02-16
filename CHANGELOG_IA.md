# 🤖 Changelog & Documentación: Resurrección de Printy

**Fecha:** 14 de Febrero de 2026
**Estado:** ✅ OPERATIVO (Monitor Funcionando, Respuestas Activas)

---

## 🛠️ Cambios Implementados (Resumen Técnico)

### 1. Diagnóstico de Conexión (Vercel)

- Problema: El Webhook en Vercel no podía leer variables `VITE_` en entorno Node (Serverless).
- Solución: Se creó endpoint de diagnóstico (`api/test-env.js`) y se confirmó que sí estaban expuestas, pero el cliente de Supabase fallaba.
- **Acción:** Se aseguró el uso de `createClient(URL, ANON_KEY)` con las variables correctas disponibles.

### 2. Token de MercadoLibre (El Corazón)

- Problema: El Token en `.env.local` estaba expirado y estático. Printy no veía preguntas nuevas.
- Solución: Se actualizó `api/ml-webhook.js` para leer el **Token Dinámico** desde la tabla `ml_tokens` de Supabase (donde se guarda al loguear).
- **Resultado:** Printy ahora siempre tiene una llave válida (si se renueva).

### 3. "Modo Agresivo" vs IA Pirata 🥊

- Problema: La IA nativa de MercadoLibre (o un bot fantasma) respondía milisegundos antes, bloqueando a Printy.
- Solución: Se modificó la lógica en `api/ml-webhook.js` para **ignorar el estado de la pregunta**.
- **Nuevo Comportamiento:** Si ML dice "Ya está respondida", Printy dice "No me importa" e intenta responder igual. Si falla por duplicado, marca éxito en el monitor.

### 4. Política de Seguridad (Anti-Ban) 🛡️

- Problema: MercadoLibre advirtió sobre "datos de contacto" por el nombre "Printy".
- Solución: Se eliminaron nombres propios y firmas de las respuestas automáticas.
- **Nueva Personalidad:** "Asistente Virtual" anónimo, enfocado en cerrar ventas dentro de la plataforma.

### 5. Renovación Automática (Vida Eterna) ♾️

- Problema: El Token caducaba cada 6 horas.
- Solución:
  - Se creó endpoint `api/ml-refresh-token.js` que usa el `refresh_token` para pedir uno nuevo.
  - Se configuró `vercel.json` con un **Cron Job** para ejecutar esto cada 5 horas.

---

## 🔒 Pendientes de Seguridad (RLS)

Actualmente, la tabla `ml_questions` permite inserciones públicas (`anon`). Esto es necesario porque el Webhook usa la `ANON_KEY`.

**Para cerrar esto en el futuro:**

1. Obtener `SUPABASE_SERVICE_ROLE_KEY` del Dashboard.
2. Agregarla a Vercel Env Vars.
3. Actualizar `api/ml-webhook.js` para usar `createClient(URL, SERVICE_KEY)`.
4. Ejecutar SQL en Supabase:
   ```sql
   ALTER TABLE ml_questions DISABLE ROW LEVEL SECURITY; -- O mejor:
   CREATE POLICY "Solo Service Role" ON ml_questions FOR ALL TO service_role USING (true);
   DROP POLICY "Public Insert" ON ml_questions;
   ```

---

## 🚀 Plan de Acción Futuro (Optimizaciones Recomendadas)

Para llevar el proyecto al "Nivel Dios" y asegurar máxima estabilidad y seguridad:

### 1. 🧠 Mover Prompt a Base de Datos (Prioridad Media)

- **Objetivo:** Permitir cambiar la personalidad de "Printy" sin tocar código.
- **Acción:** Crear tabla `ai_prompts` en Supabase y leer el `SYSTEM_PROMPT` desde ahí en tiempo real.
- **Beneficio:** Flexibilidad total para ajustar respuestas desde el Admin Panel.

### 2. 📧 Migrar Emails a HTTP API (Prioridad Alta - Fiabilidad)

- **Objetivo:** Eliminar fallos de envío de emails por timeouts de SMTP en Vercel Serverless.
- **Acción:** Reemplazar `nodemailer` (SMTP) por **Resend** o **SendGrid** (HTTP API).
- **Beneficio:** Envíos instantáneos, logs detallados y mayor entregabilidad.

### 3. 🛡️ Seguridad Total con Service Role (Prioridad Alta - Seguridad)

- **Objetivo:** Bloquear escritura pública en TODAS las tablas (incluida `ml_questions`).
- **Acción:** Configurar `SUPABASE_SERVICE_ROLE_KEY` en Vercel y actualizar webhook.
- **Beneficio:** Nadie podrá spammear tu base de datos desde afuera.

---

_Fin del reporte._
