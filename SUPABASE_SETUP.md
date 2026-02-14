# 🔒 Configuración de Autenticación Backend con Supabase

## ¿Por qué necesitas esto?

Sin backend, cualquier persona con conocimientos técnicos puede:

- Ver el código en el navegador
- Modificar localStorage
- Crear múltiples cuentas admin
- Bypasear las restricciones de seguridad

**Con Supabase tendrás:**
✅ Base de datos centralizada real
✅ Solo 1 admin permitido (validado en servidor)
✅ Imposible de hackear desde el navegador
✅ Logs de auditoría de intentos de acceso
✅ **100% GRATIS** para siempre (plan gratuito)

---

## Paso 1: Crear cuenta en Supabase

1. Ve a https://supabase.com
2. Click en "Start your project"
3. Crea una cuenta (con GitHub o Email)
4. Crea un nuevo proyecto:
   - **Name**: 3d2-auth (o el nombre que quieras)
   - **Database Password**: Guarda esta contraseña (la necesitarás)
   - **Region**: Elige el más cercano a ti
   - Click en "Create new project"
5. Espera 2-3 minutos mientras se crea el proyecto

---

## Paso 2: Configurar las tablas de base de datos

1. En tu proyecto de Supabase, ve al menú lateral izquierdo
2. Click en **"SQL Editor"**
3. Click en **"New query"**
4. Copia y pega TODO el contenido del archivo `supabase_setup.sql`
5. Click en **"Run"** (botón verde abajo a la derecha)
6. Deberías ver: "Success. No rows returned"

---

## Paso 3: Obtener las credenciales

1. En el menú lateral, ve a **"Settings"** (⚙️)
2. Click en **"API"**
3. Verás dos valores importantes:

### Project URL

```
https://xxxxxxxxxxxxx.supabase.co
```

Copia este valor completo

### anon/public key

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Copia esta clave completa (es muy larga, asegúrate de copiarla toda)

---

## Paso 4: Configurar variables de entorno

1. En tu proyecto local, abre el archivo `.env.local`
   (Si no existe, copia `.env.example` y renómbralo a `.env.local`)

2. Agrega o actualiza estas líneas:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. **IMPORTANTE**: Reemplaza con TUS valores reales de Supabase

4. Guarda el archivo

---

## Paso 5: Reiniciar el servidor de desarrollo

Si tienes el servidor corriendo (`npm run dev`):

1. Detén el servidor (Ctrl + C)
2. Vuelve a iniciarlo: `npm run dev`
3. Las variables de entorno ahora estarán cargadas

---

## Paso 6: Desplegar a producción

1. Ve a tu repositorio en GitHub
2. Click en **"Settings"** > **"Secrets and variables"** > **"Actions"**
3. Click en **"New repository secret"**
4. Agrega estos secretos:

   **Secret 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: Tu Project URL de Supabase

   **Secret 2:**
   - Name: `VITE_SUPABASE_ANON_TOKEN`
   - Value: Tu anon key de Supabase

5. Haz commit y push de tus cambios
6. GitHub Actions desplegará automáticamente con las variables

**O si despliegas manualmente:**

Antes de `npm run build`, asegúrate de que las variables estén en `.env.local`

---

## ✅ Verificar que funciona

Después de configurar, ve a la página de login (`/admin/login`):

- **Con backend activo**: Verás un mensaje verde "🔒 Seguridad: Backend activo"
- **Sin backend**: Verás un mensaje amarillo "⚠️ Modo local"

---

## 🔐 Seguridad garantizada

Con Supabase configurado:

1. **Trigger en base de datos** impide crear más de 1 admin
2. **Row Level Security (RLS)** protege las operaciones
3. **Logs de auditoría** registran todos los intentos de acceso
4. **Validación en servidor** imposible de bypasear desde el navegador

---

## 💡 Troubleshooting

### "Error: No se puede conectar a Supabase"

- Verifica que las URLs y keys estén correctas
- Asegúrate de que no haya espacios extra
- Reinicia el servidor de desarrollo

### "Error: Ya existe un administrador"

- ¡Funciona! El sistema está protegiendo contra múltiples admins
- Para resetear, usa el botón "Borrar cuenta" con tus credenciales

### "Sigo viendo modo local"

- Verifica que `.env.local` existe y tiene las variables
- Reinicia el servidor completamente
- Verifica la consola del navegador (F12) por errores

---

## 📊 Monitoreo (opcional)

Para ver los logs de intentos de acceso:

1. En Supabase, ve a **"Table Editor"**
2. Selecciona la tabla **"admin_session_logs"**
3. Verás todos los intentos de inicio de sesión con:
   - Usuario
   - Éxito/Fallo
   - IP
   - Fecha/Hora

---

## 🆓 Límites del plan gratuito de Supabase

- **500 MB de base de datos** (más que suficiente)
- **1 GB de transferencia mensual**
- **50,000 usuarios activos mensuales**
- **Sin tarjeta de crédito requerida**

Para un solo admin y logs de sesión, nunca alcanzarás estos límites.

---

## 🚀 Próximos pasos

Una vez configurado, puedes:

- Registrar tu cuenta de admin única
- Los intentos de crear más admins serán bloqueados
- Todo quedará registrado en la base de datos

**¿Necesitas ayuda?** Revisa los logs en la consola del navegador (F12)

---

## ⚠️ Actualizaciones Recientes de Seguridad (Feb 2026)

### Tabla de Gastos (`expenses`)

Se ha implementado el módulo de Finanzas. Para facilitar la carga inicial y el uso desde el panel de administración, la tabla `expenses` tiene actualmente una política de acceso público:

```sql
create policy "Public Access" on expenses for all using (true);
```

**TODO:**

- [ ] Restringir el acceso a `expenses` solo a usuarios autenticados una vez que el flujo de autenticación esté 100% estable en el dashboard.

### Tabla de Stock (`raw_materials`)

Misma política pública temporal para permitir la gestión de inventario desde el panel:

```sql
create policy "Public Access Stock" on raw_materials for all using (true);
```

**TODO:**

- [ ] Unificar permisos con la tabla de `expenses`.
