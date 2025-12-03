# 📦 Guía de Despacho con MercadoEnvíos

## Flujo Automático Post-Pago

### 1. **Cliente realiza el pago**
- El webhook de MercadoPago recibe la notificación de pago aprobado
- Automáticamente llama a `/api/ml-create-shipment`
- Se crea el envío en MercadoLibre
- Se guarda `ml_shipment_id` y `tracking_number` en Supabase

### 2. **Obtener la etiqueta de envío**

#### Opción A: Desde el Panel de Admin (Próximamente)
Agregaremos un botón en `SalesDashboard` para descargar la etiqueta directamente.

#### Opción B: Desde la API de MercadoLibre
```javascript
GET https://api.mercadolibre.com/shipments/{ml_shipment_id}/label
Headers:
  Authorization: Bearer {ML_ACCESS_TOKEN}
  Accept: application/pdf
```

La respuesta es un PDF listo para imprimir que contiene:
- Código de barras del tracking
- Datos del remitente (tu local)
- Datos del destinatario (cliente)
- Instrucciones del transportista
- Dimensiones y peso declarado

#### Opción C: Desde tu panel de vendedor de MercadoLibre
1. Ingresa a tu cuenta de vendedor en MercadoLibre
2. Ve a "Ventas" → "Envíos"
3. Busca por número de tracking
4. Descarga la etiqueta en PDF

### 3. **Preparar el paquete**
1. Empaca el producto según las dimensiones declaradas (20x20x20 cm, 500g)
2. Imprime la etiqueta en A4 o tamaño carta
3. Pega la etiqueta en el paquete de forma visible
4. Asegúrate de que el código de barras esté legible

### 4. **Despachar el paquete**
MercadoEnvíos te indicará el método de despacho según la opción seleccionada:

- **Correo Argentino**: Llevá el paquete a la sucursal más cercana o solicitá retiro
- **Andreani**: Idem, sucursal o retiro programado
- **Otros transportistas**: Según disponibilidad en tu zona

### 5. **Tracking automático**
- El cliente puede ver el estado del envío en `/order-tracking`
- Los estados se actualizan automáticamente desde ML
- El admin ve el tracking en el panel de ventas

---

## 🔧 Próximas mejoras sugeridas

### A. Botón de descarga de etiqueta en Admin
Agregar en `SalesDashboard.tsx`:
```tsx
const downloadLabel = async (mlShipmentId: string) => {
  const token = localStorage.getItem('ml_access_token');
  const response = await fetch(
    `https://api.mercadolibre.com/shipments/${mlShipmentId}/label`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf'
      }
    }
  );
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `etiqueta-${mlShipmentId}.pdf`;
  a.click();
};
```

### B. Webhook de ML para actualizar estados
Crear `/api/ml-webhook` que reciba notificaciones de cambios de estado:
- `pending`: Pendiente de despacho
- `handling`: En preparación
- `ready_to_ship`: Listo para despachar
- `shipped`: Despachado
- `delivered`: Entregado
- `cancelled`: Cancelado

### C. Notificaciones por email al cliente
Enviar emails automáticos cuando:
- El envío es creado (con tracking)
- El paquete está listo para despachar
- El paquete fue despachado
- El paquete fue entregado

---

## 📊 Información mostrada al cliente

Actualmente en el checkout se muestra:
- ✅ Costo del envío (cotización en tiempo real)
- ✅ Fecha estimada de entrega (si ML la provee)
- ✅ Número de tracking (después del pago)

## ⚙️ Variables de configuración

Asegúrate de tener en Vercel:
- `ML_ZIP_CODE_FROM`: Código postal de tu local (default: 1842 - El Jagüel)
- `ML_APP_ID`: ID de tu app de ML
- `ML_APP_SECRET`: Secret de tu app
- `ML_REDIRECT_URI`: https://www.creart3d2.com/ml-callback

En Supabase:
- Tabla `ml_tokens` con `user_id` y `access_token` vigente
- Tabla `shipments` para guardar los envíos creados
- Columnas `ml_shipment_id` y `tracking_number` en `orders`

---

## 🚨 Troubleshooting

### "No se pudo crear el envío"
- Verifica que el token de ML no esté vencido (dura 6 meses)
- Comprueba que las dimensiones sean realistas
- Asegúrate de que la dirección del cliente sea válida

### "No aparece la fecha de entrega"
- Algunos códigos postales no tienen estimación
- ML puede no proveer la fecha en ciertas zonas
- Se muestra solo "Costo calculado por MercadoEnvíos"

### "El tracking no actualiza"
- ML puede tardar hasta 24hs en actualizar el primer estado
- Una vez despachado, actualiza cada 6-12 horas
- Usa el webhook de ML para actualizaciones en tiempo real
