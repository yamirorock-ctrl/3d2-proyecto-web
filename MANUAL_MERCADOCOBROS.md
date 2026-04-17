# 💳 Centro de Control: Mercado Pago & Envíos (3D2)

Este documento es el manual maestro para la configuración, diagnóstico y mantenimiento del sistema de cobros y logística automatizada de la tienda web.

---

## 🚀 1. Estado Actual del Sistema (Diagnóstico)

> [!WARNING]
> **Evolución Tecnológica:** Mercado Pago ha evolucionado su integración. La Checkout API tradicional será descontinuada en favor de la **API de Orders**. Este manual se enfoca en el nuevo modelo para garantizar el éxito de Mercado Envíos (`me2`) y la compatibilidad a largo plazo.

| Componente | Estado | Detalle Técnico |
| :--- | :--- | :--- |
| **Integración de Pago** | ✅ OPERATIVO | Las preferencias se generan correctamente vía API. |
| **Notificaciones (Webhook)** | ✅ VALIDADO | El cableado interno (`api/webhook.js`) está corregido y seguro. |
| **Sincronización de Stock** | ✅ AUTOMÁTICA | Los productos e insumos se descuentan al confirmar el pago. |
| **Mercado Envíos (me2)** | ⚠️ BLOQUEADO | Error: `collector doesn't have me2 active`. Falta activación en el panel de MP. |

---

## 🛠️ 2. Arquitectura de Integración

### A. Flujo de Pago
1.  **Frontend:** `Checkout.tsx` calcula dimensiones y llama al servicio.
2.  **Servicio:** `mercadoPagoService.ts` construye la preferencia (Modo `Checkout Pro`).
3.  **Backend:** `api/mercadopago.js` actúa como proxy seguro (oculta el `ACCESS_TOKEN`).
    *   *Nota:* Si se usa `API de Orders`, el flujo cambia para permitir mayor control de logística.

### B. Flujo de Envíos
- **Configuración deseada:** 100% Automático (`me2`).
- **Requisito:** Tener activado "Mercado Envíos para sitios web" en la cuenta del vendedor.
- **Dimensiones:** Se envían en formato `Ancho x Alto x Largo, Peso` (Ej: `15x15x20,500`).

---

## 📋 3. Lista de Verificación (Checklist)

### Configuración en Mercado Pago
- [ ] **Crear Aplicación:** Seleccionar "Pagos Online" y "Desarrollo Propio".
- [ ] **Modelo de Cobro:** Asegurar que sea `Checkout Pro` (o `API de Orders` si migramos).
- [ ] **Credenciales:** Copiar `Access Token` de Producción al archivo `.env.local`.
- [ ] **Envíos:** Activar "Mercado Envíos" dentro de la configuración de la aplicación creada.
- [ ] **Modo de Operación:** Verificar que la cuenta no esté en "Modo Sandbox" (Pruebas).

### Configuración en la Web
- [ ] **SDK JS:** (Opcional) Incluir `<script src="https://sdk.mercadopago.com/js/v2"></script>` en `index.html`.
- [ ] **Webhook URL:** Apuntando a producción (`https://www.creart3d2.com/api/webhook`).
- [ ] **Cálculo de envío gratis:** Compras > $40.000 (Regla aplicada en frontend).

---

## 🏗️ 5. Configuración del Frontend (MercadoPago.js)

Para integraciones avanzadas o botones nativos, el frontend debe inicializar el SDK:

```javascript
// Carga del SDK
const mp = new window.MercadoPago(import.meta.env.VITE_MP_PUBLIC, {
  locale: 'es-AR'
});
```

> [!TIP]
> Actualmente usamos **Redirección Directa**, lo cual no requiere cargar el JS de MP en nuestra web, ahorrando tiempo de carga. La clienta es redirigida al entorno seguro de Mercado Pago directamente.

---

## 🚨 4. Bitácora de Errores y Soluciones

### Error: `collector doesn't have me2 active`
*   **Causa:** La cuenta de Mercado Pago no tiene permisos para usar Mercado Envíos en integraciones personalizadas.
*   **Solución:** Activar la opción en [Configuración de Envíos](https://www.mercadopago.com.ar/shipping/settings). Si no aparece, contactar a soporte de MP o subir de nivel de reputación.

---

## 🏗️ 6. Hoja de Ruta: Automatización Total (Next Level)

Para alcanzar el 100% de automatización y eliminar errores de "me2 no activo", estos son los pasos a seguir:

1.  **Migración a API de Orders:** Cambiar el endpoint de `/preferences` a `/orders`. Esto permite que Mercado Pago gestione el pedido completo, no solo el cobro.
2.  **Configuración de `processing_mode`:** Establecerlo en `aggregator` o `gateway` según la necesidad, permitiendo el procesamiento automático de envíos.
3.  **Sincronización de Webhooks Avanzada:** Configurar el webhook para escuchar eventos de `merchant_order` además de `payment`.

> [!IMPORTANT]
> La **API de Orders** es la recomendada por Mercado Pago para integraciones que requieren una logística compleja y automatizada en Argentina.

## 🏗️ 7. Estructura Técnica: API de Orders (v2)

Para la automatización total con **Mercado Envíos 2**, el payload debe cumplir:

```json
{
  "external_reference": "ORD-123",
  "total_amount": 15000.50,
  "items": [...],
  "processing_mode": "automatic",
  "shipments": {
    "mode": "me2",
    "dimensions": "20x20x20,500",
    "receiver_address": {
      "zip_code": "1428"
    }
  }
}
```

---

### ⚙️ Modos de Procesamiento:
-   **`automatic` (Recomendado):** El pago se captura e ingresa a tu cuenta inmediatamente tras la aprobación. Ideal para ventas directas.
-   **`manual` (Reserva):** El dinero se "bloquea" en la tarjeta del cliente pero no entra a tu cuenta hasta que envíes una orden de `capture`. Tienes 5 días para capturarlo o se cancela automáticamente.

### Componentes de Frontend Recomendados:
- **Card Payment Brick:** Formulario optimizado que genera el `token` de seguridad automáticamente.
- **Status Screen Brick:** Pantalla que muestra si el pago fue aprobado o rechazado sin salir de tu web.

## 🛡️ 8. Webhooks y Seguridad (Validación de Firma)

Para garantizar que los pagos son reales, el backend debe validar la cabecera `x-signature`.

### Pasos de Validación:
1.  **Extraer:** Obtener `ts` y `v1` del header `x-signature`.
2.  **Construir Manifest:** `id:[order_id];request-id:[x-request-id];ts:[timestamp];`
3.  **Calcular HMAC:** Usar la `Secret Key` de la aplicación y `SHA256`.
4.  **Comparar:** Si el hash coincide con `v1`, la notificación es legítima.

> [!CAUTION]
> El `data.id` (ID de la orden) puede llegar en MAYÚSCULAS en la URL, pero **DEBE convertirse a minúsculas** para que la validación de la firma funcione.

### Configuración en el Dashboard:
- **Tópico:** Seleccionar únicamente `Order (Mercado Pago)`.
- **URL:** `https://tuweb.com/api/webhook`
- **Respuesta:** Siempre retornar `status 200` inmediatamente para evitar reintentos.

## 🧪 9. Protocolo de Pruebas y Validación

Para realizar pruebas sin dinero real, se DEBE usar el email: `test@testuser.com`.

### Tarjetas de Prueba (Sandbox):
| Bandera | Número | CVV | Vence |
| :--- | :--- | :--- | :--- |
| **Visa** | `4509 9535 6623 3704` | `123` | `11/30` |
| **Mastercard** | `5031 7557 3453 0604` | `123` | `11/30` |

### Nombres Mágicos (Para forzar resultados):
-   **Aprobar Pago:** Usar nombre titular `APRO`.
-   **Simular Falta de Fondos:** Usar nombre titular `FUND`.
-   **Simular Error de Tarjeta:** Usar nombre titular `OTHE`.

### Verificación:
Para verificar el estado de una orden de prueba:
`GET https://api.mercadopago.com/v1/orders/{id}`

## 🎖️ 10. Certificación de Calidad (Homologación)

Antes de salir a producción, Mercado Pago debe certificar la integración.

### Proceso de Medición:
1.  **Realizar Pago de Prueba:** Ejecutar una compra real en modo Sandbox.
2.  **Obtener Order ID:** Copiar el ID de la respuesta (Ej: `ORD01JS2V...`).
3.  **Iniciar Medición:** Ir a "Tus Integraciones > Datos de Aplicación > Medir Calidad" y pegar el ID.
4.  **Puntaje:** El sistema calificará del 0 al 100.

### Requisitos para el Puntaje Máximo:
- [ ] **Webhooks activos:** Notificaciones funcionando.
- [ ] **External Reference:** Enviar siempre el ID de orden de Supabase.
- [ ] **Datos del Pagador:** Enviar Email, Nombre y DNI (mejora la aprobación).
- [ ] **SDK Actualizado:** Usar las últimas versiones de las APIs.

---

> [!TIP]
> Una integración con puntaje **100** tiene menos probabilidades de que los pagos sean rechazados por el motor antifraude de Mercado Pago.

## 💰 11. Gestión de Reembolsos y Cancelaciones

- **Reembolso:** Se puede realizar hasta 180 días después del pago.
- **Cancelación:** Solo si el estado es `action_required`.

### Endpoints:
- `POST /v1/orders/{order_id}/refund` (Monto vacío para total, o `amount` para parcial).
- `POST /v1/orders/{order_id}/cancel` (Para anular reservas no capturadas).

---

## 🚀 12. Optimización y Aprobación (Device ID)

Para evitar rechazos por "Alto Riesgo" (`high_risk`), es obligatorio enviar el **Device ID**.

### En el Frontend:
1. Incluir el script: `<script src="https://www.mercadopago.com/v2/security.js" view="checkout"></script>`
2. Capturar la variable global: `window.MP_DEVICE_SESSION_ID`

### En el Backend (Creación de Orden):
Enviar el header:
`X-meli-session-id: [VALOR_DEL_DEVICE_ID]`

### Datos de Industria:
Para 3D2, incluir siempre en `additional_info`:
- Detalle del producto (items).
- Dirección de envío completa.
- Teléfono y DNI del comprador.

---

> [!IMPORTANT]
> **Nombre en Resumen de Tarjeta:** Usar el parámetro `statement_descriptor` (ej: `CREART3D2`) para que el cliente reconozca el cargo y evitar contracargos por confusión.

## 📖 13. Glosario de Estados y Errores

### Estados de Orden / Transacción:
| Status | Status Detail | Significado |
| :--- | :--- | :--- |
| **`processed`** | `accredited` | **¡ÉXITO!** El dinero ya está en tu cuenta. |
| **`processing`** | `in_process` | Pago pendiente de acreditación (ej: transferencia). |
| **`action_required`** | `waiting_payment` | El cliente aún no completó el pago. |
| **`failed`** | `high_risk` | Rechazado por prevención de fraude. |
| **`failed`** | `insufficient_amount` | Tarjeta sin fondos suficientes. |

### Manejo de Errores Comunes:
- **400 `invalid_total_amount`:** La suma de los items no coincide con el total.
- **401 `invalid_credentials`:** El Token está mal o estás usando uno de prueba en producción.
- **409 `idempotency_key_already_used`:** Estás enviando la misma clave para dos compras distintas.
- **500 `internal_error`:** Problema de Mercado Pago. Reintentar en unos minutos.

---

> [!IMPORTANT]
> **Idempotencia:** Siempre enviar el header `X-Idempotency-Key`. Recomendamos usar el ID de la orden de tu base de datos.

---

## 📅 14. Logística Pro: Gestión de Tiempos y Feriados

Para proteger tu reputación y dar fechas de entrega precisas, Mercado Pago/Libre permite gestionar tus días no laborables.

### A. Consultar Días No Laborales:
`GET https://api.mercadolibre.com/shipping/seller/{seller_id}/working_day_dashboard`

### B. Campos Clave de Respuesta:
- **`checked`:** Si es `true`, el vendedor NO trabaja ese día.
- **`description`:** Nombre del feriado o motivo (ej: "Día del Pueblo").
- **`date`:** Fecha en formato `YYYY-MM-DD`.

### C. Importancia para la Reputación:
Si marcas un día como "No Laboral", Mercado Libre **no contará ese día** dentro del tiempo de despacho exigido. Esto es ideal para feriados puente o mantenimiento de taller.

---

## 🛰️ 16. Webhooks de Envíos (Shipments)

El sistema ahora procesa notificaciones automáticas cuando el paquete se mueve.

### A. Estados de Envío (me2):
- **`pending`:** El pago aún no se acreditó o el envío está en espera.
- **`handling`:** Pago aprobado. El vendedor debe preparar el paquete.
- **`ready_to_ship`:** Etiqueta generada. Listo para despachar/colecta.
- **`shipped`:** El paquete ya está en manos del correo.
- **`delivered`:** El cliente recibió el producto. **(Marca la orden como Completada)**.
- **`not_delivered` / `cancelled`:** Problemas en la entrega o cancelación.

### B. Datos Capturados Automáticamente:
Cada vez que recibimos un webhook de envío, el sistema guarda:
1. **`shipping_status`:** El estado actual del paquete.
2. **`tracking_number`:** El número de seguimiento oficial para el cliente.

---

## 🗺️ 17. Geografía y Validación de Direcciones

Para asegurar que Mercado Envíos nunca rechace una etiqueta por "Dirección Inválida", puedes consultar la base de datos oficial de Mercado Libre:

### A. Endpoints de Consulta:
- **Países:** `https://api.mercadolibre.com/countries/AR`
- **Provincias:** `https://api.mercadolibre.com/states/{state_id}`
- **Ciudades:** `https://api.mercadolibre.com/cities/{city_id}`

### B. Datos Críticos del Receptor:
Al enviar los datos a la API de Orders, asegúrate de que estos campos estén presentes:
- `street_name` y `street_number` (No concatenar en un solo campo si es posible).
- `zip_code` (Validar que tenga 4 dígitos para Argentina).
- `city.name` y `state.name`.

---

> _Manual Maestro de Mercado Pago - Versión Final 2.3 (Full Logistics & Geolocation)_
