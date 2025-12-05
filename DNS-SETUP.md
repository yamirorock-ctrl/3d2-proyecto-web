# Configuración DNS para creart3d2.com

## Registros DNS a configurar en tu proveedor:

### 1. Para el dominio raíz (creart3d2.com):
Agrega estos 4 registros tipo **A**:

```
Tipo: A
Nombre: @ (o creart3d2.com)
Valor: 185.199.108.153
TTL: 3600

Tipo: A
Nombre: @ (o creart3d2.com)
Valor: 185.199.109.153
TTL: 3600

Tipo: A
Nombre: @ (o creart3d2.com)
Valor: 185.199.110.153
TTL: 3600

Tipo: A
Nombre: @ (o creart3d2.com)
Valor: 185.199.111.153
TTL: 3600
```

### 2. Para el subdominio www (www.creart3d2.com):
Agrega 1 registro tipo **CNAME**:

```
Tipo: CNAME
Nombre: www
Valor: yamirorock-ctrl.github.io
TTL: 3600
```

## Pasos siguientes:

1. **Configura los registros DNS** en tu proveedor de dominio (panel DNS).

2. **Despliega tu sitio**:
   ```powershell
   npm run deploy
   ```

3. **Configura GitHub Pages**:
   - Ve a: https://github.com/yamirorock-ctrl/3d2-proyecto-web/settings/pages
   - En "Custom domain" ingresa: `www.creart3d2.com`
   - Espera la verificación DNS (puede tardar 5-30 minutos)
   - Marca "Enforce HTTPS" cuando esté disponible

4. **Verifica**:
   - Espera propagación DNS (5-30 min)
   - Visita: https://www.creart3d2.com
   - GitHub generará certificado SSL automáticamente

## Notas:
- El archivo `CNAME` en `/public/CNAME` ya está configurado con `www.creart3d2.com`
- Los cambios en `vite.config.ts` y `package.json` ajustan las rutas para el dominio propio
- Si quieres que `creart3d2.com` (sin www) redirija a `www.creart3d2.com`, algunos proveedores DNS ofrecen "URL Redirect" o "Forwarding"
