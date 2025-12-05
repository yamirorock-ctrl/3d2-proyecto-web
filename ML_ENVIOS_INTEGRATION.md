# Integración MercadoEnvíos - Completada ✅

## Resumen de Cambios

Se ha implementado la integración completa de MercadoEnvíos para gestionar el envío de productos vendidos a través de la tienda.

## Archivos Creados/Modificados

### Nuevos Servicios
1. **`services/mlShippingService.ts`** - Servicio para cotizar y crear envíos con MercadoLibre
   - `getShippingOptions()`: Cotizar opciones de envío disponibles
   - `createShipment()`: Crear envío después de confirmar el pago
   - `getShipmentInfo()`: Obtener estado actualizado de un envío
   - `estimateCartDimensions()`: Calcular dimensiones estimadas del carrito

### Nuevos Endpoints Backend
2. **`api/ml-create-shipment.js`** - Endpoint serverless para crear envíos en ML
   - POST `/api/ml-create-shipment` 
   - Parámetros: `{ orderId, userId }`
   - Crea el envío en MercadoLibre y guarda el tracking en Supabase

### Actualizaciones
3. **`api/webhook.js`** - Webhook de MercadoPago actualizado
   - Ahora detecta cuando un pago es aprobado (`status: 'paid'`)
   - Llama automáticamente a `ml-create-shipment` si el método de envío es `moto` o `correo`
   - No bloqueante: si falla la creación del envío, el pago se procesa igualmente

4. **`components/SalesDashboard.tsx`** - Panel de ventas con tracking
   - Muestra número de seguimiento cuando está disponible
   - Muestra ID del envío de MercadoLibre
   - Muestra método de envío seleccionado
   - Sección destacada con ícono de camión (Truck)

5. **`.env.local`** - Variables de entorno actualizadas
   - `VITE_MP_WEBHOOK_URL=https://3d2-bewhook.vercel.app/api/webhook`

6. **`.github/workflows/deploy.yml`** - CI/CD actualizado
   - Agregadas variables: `VITE_MP_WEBHOOK_URL`, `VITE_ML_APP_ID`, `VITE_ML_APP_SECRET`, `VITE_ML_REDIRECT_URI`

### Base de Datos
7. **`supabase_shipments_table.sql`** - Script SQL para crear tabla de envíos
   - Tabla `shipments` con: order_id, ml_shipment_id, tracking_number, carrier, status, etc.
   - Índices para optimizar consultas
   - Columnas agregadas a `orders`: `tracking_number`, `ml_shipment_id`

## Flujo Completo

### 1. Cliente Realiza Compra
- Selecciona productos y va al checkout
- Completa datos de contacto y dirección
- Selecciona método de envío (moto, correo, retiro, a coordinar)
- Crea orden en Supabase con status `pending`

### 2. Pago con MercadoPago
- Se crea preferencia de pago con `external_reference = orderId`
- Cliente paga y es redirigido al sitio

### 3. Webhook Recibe Notificación
- MercadoPago envía notificación POST a `https://3d2-bewhook.vercel.app/api/webhook`
- Webhook actualiza orden a status `paid` si el pago fue aprobado
- Si método de envío es `moto` o `correo`, llama a `/api/ml-create-shipment`

### 4. Creación Automática de Envío
- `/api/ml-create-shipment` obtiene el token de ML desde Supabase (tabla `ml_tokens`)
- Llama a API de MercadoLibre: `POST /shipments`
- Guarda el `tracking_number` y `ml_shipment_id` en Supabase

### 5. Admin Ve Tracking
- En el panel de ventas, el admin puede ver:
  - Número de seguimiento
  - ID del envío en MercadoLibre
  - Método de envío seleccionado
  - Estado del envío

## Configuración Requerida

### ✅ Ya Configurado
- [x] MercadoLibre OAuth (App ID, Secret, Redirect URI)
- [x] MercadoPago Webhook URL actualizada
- [x] Variables en GitHub Secrets
- [x] Endpoint `/api/ml-create-shipment` creado
- [x] Tabla `ml_tokens` en Supabase (creada previamente)

### ⚠️ Pendiente de Ejecución Manual
1. **Ejecutar SQL en Supabase**:
   - Abrir Supabase Dashboard → SQL Editor
   - Copiar y ejecutar el contenido de `supabase_shipments_table.sql`
   - Esto creará la tabla `shipments` y agregará columnas a `orders`

2. **Conectar MercadoLibre en el Admin**:
   - Ir al panel de admin → Tab "Productos"
   - Click en "Conectar MercadoLibre"
   - Autorizar la aplicación
   - El token se guardará automáticamente en `ml_tokens`

3. **Asociar user_id al vendedor** (opcional pero recomendado):
   - Actualmente el webhook usa `'admin-default'` como user_id
   - Para producción, deberías crear una fila en `ml_tokens` con el user_id real del vendedor

## Métodos de Envío Soportados

| Método | Descripción | Crea envío ML? |
|--------|-------------|----------------|
| `moto` | Envío en moto (zona BsAs) | ✅ Sí |
| `correo` | Correo Argentino / Andreani | ✅ Sí |
| `retiro` | Retiro en local | ❌ No |
| `to_coordinate` | A coordinar (interior) | ❌ No |

## Próximos Pasos (Mejoras Futuras)

### Cotización Dinámica de Envíos
Actualmente el costo de envío se calcula con precios fijos en `shipping_config`. Para usar cotización real de MercadoLibre:

1. Modificar `Checkout.tsx` para llamar a `getShippingOptions()` al completar la dirección
2. Mostrar opciones reales (estándar, express, etc.) con costos de ML
3. Guardar `shipping_method_id` seleccionado en la orden
4. Pasar ese ID al crear el envío con `ml-create-shipment`

### Webhook de MercadoLibre
Para recibir actualizaciones de estado del envío:

1. Configurar webhook de ML en: https://developers.mercadolibre.com.ar/
2. URL: `https://3d2-bewhook.vercel.app/api/ml-webhook`
3. Actualizar `api/ml-webhook.js` para procesar eventos de `shipments`
4. Sincronizar estado en Supabase cuando el envío cambie a `delivered`, etc.

### Dimensiones Reales de Productos
Actualmente se usa `estimateCartDimensions()` con valores fijos. Mejora:

1. Agregar campos `width`, `height`, `length`, `weight` a la tabla `products`
2. Capturar estas dimensiones al crear/editar productos
3. Usar dimensiones reales al cotizar y crear envíos

## Testing

### Probar Creación Manual de Envío
```bash
curl -X POST https://3d2-bewhook.vercel.app/api/ml-create-shipment \
  -H "Content-Type: application/json" \
  -d '{"orderId": "ORDER_UUID", "userId": "admin-default"}'
```

### Probar Webhook con Payment ID Real
```bash
curl "https://3d2-bewhook.vercel.app/api/webhook?test_payment_id=PAYMENT_ID&order_id=ORDER_UUID"
```

## Troubleshooting

### "ML token not found"
- Asegúrate de haber conectado MercadoLibre desde el panel de admin
- Verifica que exista una fila en la tabla `ml_tokens` con el `user_id` correcto

### "Failed to create shipment"
- Revisa los logs de Vercel: https://vercel.com/yamil-sanchezs-projects/3d2-bewhook/logs
- Verifica que el token de ML no haya expirado (renovar cada 6 meses)
- Asegúrate de que la dirección esté completa y en formato correcto

### Envío no se crea automáticamente
- Verifica que el método de envío sea `moto` o `correo`
- Revisa que el pago haya sido aprobado (status `paid`)
- Chequea logs del webhook para ver si hubo errores

---

**Documentación oficial de APIs utilizadas**:
- MercadoLibre Shipping API: https://developers.mercadolibre.com.ar/es_ar/gestion-de-envios
- MercadoPago Webhooks: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
