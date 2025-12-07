# Webhook de MercadoPago - Configuración en Vercel

Este proyecto incluye una función serverless en Vercel para procesar webhooks de MercadoPago.

## 📋 Pasos para configurar:

### 1. Crear cuenta en Vercel (si no tienes)
- Ve a https://vercel.com/signup
- Conecta tu cuenta de GitHub

### 2. Instalar Vercel CLI
```bash
npm install -g vercel
```

### 3. Login en Vercel
```bash
vercel login
```

### 4. Desplegar el proyecto
```bash
vercel
```

### 5. Configurar variables de entorno en Vercel
Ve a tu proyecto en Vercel Dashboard → Settings → Environment Variables y agrega:

- `VITE_SUPABASE_URL` = tu URL de Supabase
- `VITE_SUPABASE_ANON_TOKEN` = tu anon key de Supabase
- `VITE_MP_ACCESS_TOKEN` = tu access token de MercadoPago

### 6. Obtener la URL del webhook
Después del deploy, Vercel te dará una URL como:
```
https://tu-proyecto.vercel.app/api/webhook
```

### 7. Configurar en MercadoPago
1. Ve a https://www.mercadopago.com.ar/developers/panel/app
2. Selecciona tu aplicación
3. Ve a "Webhooks"
4. Agrega la URL: `https://tu-proyecto.vercel.app/api/webhook`
5. Selecciona eventos: "Pagos" (payments)

## 🧪 Probar el webhook

### Localmente (con ngrok):
```bash
# Terminal 1: Instalar y ejecutar ngrok
npx ngrok http 3000

# Terminal 2: Ejecutar Vercel dev
vercel dev
```

Usa la URL de ngrok en MercadoPago para pruebas locales.

## 🔍 Ver logs
```bash
vercel logs
```

## ✅ Funcionamiento

Cuando un pago es procesado en MercadoPago:
1. MercadoPago envía POST a `/api/webhook`
2. El webhook consulta los detalles del pago
3. Actualiza el estado de la orden en Supabase:
   - `approved` → `processing`
   - `pending` → `pending`
   - `rejected` → `cancelled`
