import { createClient } from '@supabase/supabase-js';
import Afip from '@afipsdk/afip.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_TOKEN;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// 🩺 Limpieza de Certificados, Claves y CUIT
const cleanKey = (key) => {
  if (!key) return '';
  return key.toString()
    .replace(/["']/g, '') // Quita comillas accidentales
    .replace(/\\n/g, '\n') // Convierte \n literales en saltos reales
    .trim();
};

const cleanCUIT = (cuit) => {
  if (!cuit) return null;
  const cleaned = cuit.toString().replace(/[-"'\s]/g, '').trim();
  return cleaned ? parseInt(cleaned) : null;
};

const CUIT = cleanCUIT(process.env.VITE_AFIP_CUIT || process.env.AFIP_CUIT);
const CERT = cleanKey(process.env.AFIP_CERTIFICATE);
const KEY = cleanKey(process.env.AFIP_PRIVATE_KEY);
const PUNTO_VENTA = parseInt(process.env.AFIP_PUNTO_VENTA || "2");

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  
  if (!supabase) {
     console.error("[ARCA] Error: Supabase no inicializado. Faltan variables de entorno.");
     return res.status(500).json({ error: 'Supabase no configurado' });
  }

  let afip;
  try {
     if (!CUIT || !CERT || !KEY) {
        const missing = [];
        if (!CUIT) missing.push("CUIT");
        if (!CERT) missing.push("CERT");
        if (!KEY) missing.push("KEY");
        throw new Error(`Faltan variables: ${missing.join(", ")}`);
     }
     
     // Soporte para default export en diferentes entornos
     const AfipClass = Afip.default || Afip;
     afip = new AfipClass({
        CUIT: CUIT,
        cert: CERT,
        key: KEY,
        production: true,
        res_folder: '/tmp/afip_cache/' 
     });
     
     console.log(`[ARCA] Instancia creada para CUIT: ${CUIT}`);
  } catch (e) {
     console.error("[ARCA Init Error]", e.message);
     return res.status(500).json({ connection: 'ERROR', message: 'Credenciales inválidas: ' + e.message });
  }

  if (req.method === 'GET') {
     try {
        // Test de conexión real
        const statuses = await afip.ElectronicBilling.getServerStatus();
        console.log("[ARCA] Estado del servidor obtenido correctamente");
        return res.status(200).json({ 
          connection: 'OK', 
          message: 'Comunicación con AFIP establecida',
          afip_status: statuses 
        });
     } catch (e) {
        console.error("[ARCA Status Error]", e.message);
        
        // Si el error es 401, lo manejamos como un estado "en espera"
        const isAuthError = e.message.includes('401') || e.message.includes('Unauthorized');
        
        return res.status(200).json({ 
          connection: 'ERROR', 
          message: isAuthError ? 'AFIP está procesando tu nuevo certificado (Error 401).' : `Error de conexión: ${e.message}`,
          detail: e.message,
          tip: isAuthError ? 'Esto es normal tras subir un certificado. Aguardá 15-30 minutos.' : 'Revisá la configuración del Punto de Venta y las claves en Vercel.'
        });
     }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { action, orderData } = req.body;
  if (!action) return res.status(400).json({ error: 'Falta accion' });

  try {
    switch (action) {
      case 'get-last-invoice': {
        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(PUNTO_VENTA, 11);
        return res.status(200).json({ last_number: lastVoucher });
      }

      case 'create-invoice': {
        if (!orderData) return res.status(400).json({ error: 'Faltan datos del pedido' });
        
        const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0].replace(/-/g, '');
        
        const data = {
          'CantReg': 1,
          'PtoVta': PUNTO_VENTA,
          'CbteTipo': 11, 
          'Concepto': 1, 
          'DocTipo': orderData.docTipo || 99, 
          'DocNro': parseInt(orderData.docNro || 0),
          'CbteDesde': 0, 
          'CbteHasta': 0,
          'CbteFch': date,
          'ImpTotal': parseFloat(orderData.total),
          'ImpTotConc': 0,
          'ImpNeto': parseFloat(orderData.total),
          'ImpOpEx': 0,
          'ImpIVA': 0,
          'ImpTrib': 0,
          'MonId': 'PES',
          'MonCotiz': 1
        };

        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(PUNTO_VENTA, 11);
        data.CbteDesde = lastVoucher + 1;
        data.CbteHasta = lastVoucher + 1;

        console.log(`[ARCA] Emitiendo comprobante ${data.CbteDesde}...`);
        const invoiceResponse = await afip.ElectronicBilling.createVoucher(data);

        // Al usar SERVICE_ROLE_KEY arriba, esta inserción funcionará aunque la tabla tenga RLS activo y sin políticas.
        const { data: dbData, error: dbError } = await supabase
          .from('afip_invoices')
          .insert({
            order_id: orderData.id,
            cbte_tipo: 11,
            punto_venta: PUNTO_VENTA,
            cbte_numero: data.CbteDesde,
            cae: invoiceResponse.CAE,
            cae_vto: invoiceResponse.CAEFchVto,
          });

        if (dbError) {
          console.error("[Supabase Error]", dbError.message);
        }

        return res.status(200).json({
          success: true,
          cbte_number: data.CbteDesde,
          cae: invoiceResponse.CAE,
          cae_vto: invoiceResponse.CAEFchVto
        });
      }

      default:
        return res.status(400).json({ error: 'Accion no soportada' });
    }
  } catch (error) {
    console.error("[ARCA Engine] Error:", error);
    return res.status(500).json({ 
      error: error.message || 'Error desconocido en AFIP',
      detail: error.code || 'SOAP_ERROR'
    });
  }
}
