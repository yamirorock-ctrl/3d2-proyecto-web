# 💳 Información de Pago y Envío - 3D²

## 📋 Datos Bancarios

### Transferencia Bancaria

**Banco Provincia - Caja de Ahorro**

```
CBU: 0140058803500158646826
Alias: rock.ciclos.soda
Titular: Yamil Sanchez
CUIL: 20-33286626-6
```

---

## 💰 MercadoPago

```
Alias: yamiro.rock
CVU: 0000003100081752940884
```

---

## 📦 Opciones de Envío

### 1. Retiro en Punto
- **Costo:** GRATIS
- **Detalles:** Se coordina punto de encuentro con el cliente
- **Tiempo de preparación:** 24 horas

### 2. Envío a CABA (Capital Federal)
- **Costo:** Calculado por logística
- **Envío GRATIS:** Compras mayores a $50.000
- **Zonas:** Toda Capital Federal
- **Tiempo:** 24hs preparación + tiempo de envío

### 3. Envío a GBA (Gran Buenos Aires)
- **Costo:** Calculado por logística
- **Envío GRATIS:** Compras mayores a $50.000
- **Zonas:** Gran Buenos Aires
- **Tiempo:** 24hs preparación + tiempo de envío

---

## ⚙️ Configuración en el Sistema

### Checkout automático incluye:
✅ Selector de método de pago (Transferencia/Efectivo/MercadoPago)
✅ Selector de envío (CABA/GBA/Retiro)
✅ Cálculo de envío gratis automático (> $50k)
✅ Campo para ingresar costo de envío coordinado
✅ Validación de dirección obligatoria para envíos
✅ Pantalla de confirmación con datos bancarios/MP completos

### Panel Admin muestra:
✅ Método de envío elegido
✅ Costo de envío (si aplica)
✅ Dirección de entrega
✅ Estado del pedido
✅ Método de pago

---

## 📧 Notificaciones

El cliente recibe:
- Confirmación inmediata en pantalla con datos de pago
- Email con toda la información (requiere configurar EmailJS)
- Tiempo estimado de preparación y entrega

---

## 🔄 Flujo de Trabajo

1. Cliente completa checkout y elige método de envío
2. Si elige envío y no califica para gratis, se le indica que será contactado para calcular costo
3. Admin ve el pedido en la pestaña "Ventas"
4. Admin contacta al cliente para coordinar logística si es necesario
5. Admin confirma el pago y marca el pedido como completado

---

**Actualizado:** 26 de noviembre de 2025
