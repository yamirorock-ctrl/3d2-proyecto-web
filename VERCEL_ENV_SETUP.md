# Configuración de Variables en Vercel (Proyecto Webhook)

## Variables Requeridas

Ve a: https://vercel.com/yamil-sanchezs-projects/3d2-bewhook/settings/environment-variables

Agrega las siguientes variables:

### Supabase
```
SUPABASE_URL = https://oyxzkeuvrvmqcvleekzo.supabase.co
VITE_SUPABASE_ANON_TOKEN = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eHprZXV2cnZtcWN2bGVla3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzODM4NTQsImV4cCI6MjA3OTk1OTg1NH0.S7XxmgBNpqofcKlZzFA78Ev3ic7ji9Vd9vRbJIOJbEw
```

### MercadoPago
```
MP_ACCESS = APP_USR-6189006159413944-112923-8089b452832ed63b036b346b5c5386dc-414444653
```

### MercadoLibre
```
ML_APP_ID = 5838942654994123
ML_APP_SECRET = kcETuVxKitH1kvSrnhraI4RMstwwJfBG
ML_REDIRECT_URI = https://www.creart3d2.com/ml-callback
```

## Después de agregar las variables

1. Ve a la pestaña **Deployments**
2. Click en los **3 puntos** del último deployment
3. **Redeploy** para que tome las nuevas variables

## Verificar que funciona

Abre en el navegador:
```
https://3d2-bewhook.vercel.app/api/webhook
```

Deberías ver un JSON con `"ok": true`
