# 📘 Manual Estratégico de Integración Mercado Libre (3D2 Store)

Este documento es la "Biblia" técnica de la integración entre Vanguard y Mercado Libre. Debe ser consultado antes de realizar cualquier cambio en los endpoints o en la lógica de procesamiento de datos.

---

## 📑 Tabla de Contenidos
1. [Gestión de Identidades (Crítico)](#1-gestión-de-identidades-crítico)
2. [Mercado Ads V2 (Publicidad)](#2-mercado-ads-v2-publicidad)
3. [Monitoreo de Aplicación (Health Check)](#3-monitoreo-de-aplicación-health-check)
4. [Gestión de Tokens y Scopes](#4-gestión-de-tokens-y-scopes)

---

## 1. Gestión de Identidades (Crítico)
Para evitar fallos de conexión, es vital distinguir entre las dos identidades del sistema:

| Identidad | Origen | Uso en el Sistema |
| :--- | :--- | :--- |
| **Supabase User ID** | UUID (Auth) | Indexar el token en la tabla `ml_tokens`. |
| **ML Numeric ID** | `data.user_id` | Se usa en las URLs de la API (ej: `/users/{ml_id}/items`). |

> [!IMPORTANT]
> Nunca uses el UUID de Supabase para llamar a la API de Mercado Libre. Usa siempre el `ml_user_id` guardado en la sesión.

---

## 2. Mercado Ads V2 (Publicidad)
A partir de febrero de 2026, los endpoints de publicidad cambiaron radicalmente.

### Flujo de Consulta Obligatorio:
1. **Paso 1: Obtener Advertiser ID**
   - Endpoint: `GET /advertising/advertisers?product_id=PADS`
   - Header: `api-version: 1`
2. **Paso 2: Consultar Métricas**
   - Endpoint: `GET /advertising/MLA/advertisers/{advertiser_id}/product_ads/campaigns/search`
   - Header: `api-version: 2` (Mandatorio)
   - Params: Requiere `date_from` y `date_to` (Formato YYYY-MM-DD).

### Transición de Métricas (2026):
- **ROAS (Return on Ad Spend):** Es el nuevo estándar de performance.
- **ACOS:** Se mantiene como métrica opcional hasta marzo de 2026.
- **Fórmula:** `ACOS = (1 / ROAS) * 100`.

---

## 3. Monitoreo de Aplicación (Health Check)
Para auditar el consumo y evitar bloqueos por Rate Limiting:

- **Detalles de App:** `GET /applications/{app_id}`
- **Consumo de API:** `GET /applications/v1/{app_id}/consumed-applications`
- **Límite Estándar:** 18,000 peticiones por hora.

---

## 4. Gestión de Tokens y Scopes
### Estados de Autorización:
- **Nueva:** Generada hace menos de 24h.
- **Activa:** Uso en los últimos 90 días.
- **Inactiva:** Sin llamadas en 90 días (Requiere re-login del usuario).

### Verificación de Permisos (Scopes):
Para saber si tenemos permiso de Publicidad o Escritura:
- `GET /users/{user_id}/applications`
- Buscar el array `"scopes": ["read", "write", "offline_access", "advertising"]`.

---
*Última actualización: 12 de Abril, 2026 - Auditoría de Vanguard.*
