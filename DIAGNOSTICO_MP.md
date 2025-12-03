# Diagnóstico MercadoPago - Sincronización

## Problema Actual
La sincronización con MercadoPago no funciona correctamente.

## Pasos para Diagnosticar

### 1. Verificar URL del Webhook en Vercel
La URL del webhook está hardcodeada. Debes verificar cuál es la URL correcta de tu proyecto en Vercel:

1. Ve a tu panel de Vercel: https://vercel.com/dashboard
2. Selecciona el proyecto del webhook (3d2-bewhook)
3. Copia la URL de producción (debería verse como: `https://NOMBRE-PROYECTO.vercel.app`)
4. La URL completa del webhook será: `https://TU-PROYECTO.vercel.app/api/webhook`

### 2. Actualizar Variables de Entorno

#### En `.env.local` (desarrollo):
```env
VITE_MP_WEBHOOK_URL=https://TU-PROYECTO.vercel.app/api/webhook
```

#### En GitHub Secrets (para deploy automático):
1. Ve a tu repositorio en GitHub
2. Settings → Secrets and variables → Actions
3. Agrega o actualiza: `VITE_MP_WEBHOOK_URL` con el valor correcto

#### En Vercel (para el webhook backend):
1. Ve a tu proyecto webhook en Vercel Dashboard
2. Settings → Environment Variables
3. Verifica que existen:
   - `SUPABASE_URL` o `VITE_SUPABASE_URL`
   - `SUPABASE_ANON` o `VITE_SUPABASE_ANON`
   - `MP_ACCESS` o `VITE_MP_ACCESS`

### 3. Verificar que el Webhook Funciona

#### Opción A: Test GET directo
Abre en tu navegador:
```
https://TU-PROYECTO.vercel.app/api/webhook
```

Deberías ver algo como:
```json
{
  "ok": true,
  "message": "Webhook activo",
  "lookingFor": {
    "SUPABASE_URL o VITE_SUPABASE_URL": true,
    "SUPABASE_ANON o VITE_SUPABASE_ANON": true,
    "MP_ACCESS o VITE_MP_ACCESS": true
  }
}
```

Si alguno de los valores es `false`, falta configurar esa variable en Vercel.

#### Opción B: Test con Payment ID
Si ya hiciste un pago de prueba y tienes el payment_id, puedes forzar la actualización:
```
https://TU-PROYECTO.vercel.app/api/webhook?test_payment_id=PAYMENT_ID&order_id=ORDER_UUID
```

### 4. Verificar en MercadoPago Dashboard

1. Ve a: https://www.mercadopago.com.ar/developers/panel/app/YOUR_APP_ID/webhooks
2. Verifica que tu URL de webhook esté configurada allí
3. Si no está, agrégala:
   - URL: `https://TU-PROYECTO.vercel.app/api/webhook`
   - Eventos: `payment` y `merchant_order`

### 5. Revisar Logs de Vercel

1. Ve a tu proyecto webhook en Vercel Dashboard
2. Click en "Logs" o "Functions"
3. Busca las invocaciones recientes a `/api/webhook`
4. Revisa si hay errores o si no está recibiendo llamadas

### 6. Hacer un Pago de Prueba

1. En tu tienda, agrega productos al carrito
2. Procede al checkout con MercadoPago
3. Usa una tarjeta de prueba (si estás en modo sandbox):
   - Tarjeta: 5031 7557 3453 0604
   - Vencimiento: 11/25
   - CVV: 123
   - Nombre: APRO
4. Completa el pago
5. Verifica en Vercel Logs si llegó la notificación
6. Verifica en Supabase si se actualizó el estado de la orden

## Problemas Comunes

### "Variables de entorno faltantes en Vercel"
- **Síntoma**: El webhook responde con `error: 'Server misconfigured'`
- **Solución**: Agrega `SUPABASE_URL`, `SUPABASE_ANON`, y `MP_ACCESS` en Vercel → Settings → Environment Variables

### "El webhook no recibe notificaciones"
- **Síntoma**: Los pagos se completan pero el estado no se actualiza
- **Posibles causas**:
  1. URL del webhook incorrecta o desactualizada
  2. Webhook no configurado en MercadoPago Dashboard
  3. Proyecto de Vercel inactivo o con errores

### "Payment not found en logs"
- **Síntoma**: Webhook recibe notificación pero no puede consultar el pago
- **Posible causa**: `MP_ACCESS` token inválido o expirado en Vercel

## Solución Rápida

Si nada funciona, puedes usar el modo manual:

1. Abre la consola del navegador (F12) en tu sitio
2. Ejecuta:
```javascript
localStorage.setItem('debug_mp', 'true');
```
3. Haz un pago de prueba
4. Anota el `payment_id` que aparece en la URL de retorno
5. Llama manualmente al webhook:
```
https://TU-PROYECTO.vercel.app/api/webhook?test_payment_id=PAYMENT_ID&order_id=ORDER_UUID
```

## Próximos Pasos

1. Verifica la URL correcta de Vercel
2. Actualiza `VITE_MP_WEBHOOK_URL` en todas partes
3. Haz commit y push de los cambios
4. Prueba con un pago real o de sandbox
5. Monitorea los logs de Vercel

---

**IMPORTANTE**: Después de actualizar las variables de entorno en Vercel, debes hacer un nuevo deploy para que los cambios surtan efecto. Puedes forzar un redeploy desde Vercel Dashboard → Deployments → botón "..." → Redeploy.
