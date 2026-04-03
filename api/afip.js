import { createClient } from '@supabase/supabase-js';
import Afip from '@afipsdk/afip.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_TOKEN;

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 🩺 Limpieza de Certificados, Claves y CUIT (AFIP a veces viene con \n o comillas literales)
const cleanKey = (key) => {
  if (!key) return '';
  return key.replace(/\\n/g, '\n').trim();
};

const cleanCUIT = (cuit) => {
  if (!cuit) return '';
  // Elimina comillas dobles, simples y espacios que puedan venir de Vercel/env
  return cuit.toString().replace(/["'\s]/g, '').trim();
};

const CUIT = cleanCUIT(process.env.VITE_AFIP_CUIT || process.env.AFIP_CUIT);
const CERT = cleanKey(process.env.AFIP_CERTIFICATE);
const KEY = cleanKey(process.env.AFIP_PRIVATE_KEY);
const PUNTO_VENTA = parseInt(process.env.AFIP_PUNTO_VENTA || "2"); // PV configurado hoy

export default async function handler(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  
  // LOG DE SEGURIDAD (Solo para Vercel CLI, no expone claves reales)
  console.log(`[ARCA] Iniciando con CUIT: ${CUIT.substring(0, 4)}... PV: ${PUNTO_VENTA}`);

  if (!supabase) return res.status(500).json({ error: 'Supabase no configurado' });

  // INICIALIZAMOS AFIP DENTRO DEL HANDLER CON DIRECTORIO TEMPORAL
  let afip;
  try {
     if (!CUIT || !CERT || !KEY) throw new Error(`Faltan variables: CUIT=${!!CUIT}, CERT=${!!CERT}, KEY=${!!KEY}`);
     
     afip = new Afip({
        CUIT: CUIT,
        cert: CERT,
        key: KEY,
        production: true,
        res_folder: '/tmp/' 
     });
  } catch (e) {
     console.error("[ARCA Init Error]", e.message);
     return res.status(500).json({ connection: 'ERROR', message: 'Falla en credenciales ARCA: ' + e.message });
  }

  // SOLO PETICIONES POST PARA FACTURAR O GET PARA ESTADO
  if (req.method === 'GET') {
     try {
        const statuses = await afip.ElectronicBilling.getServerStatus();
        return res.status(200).json({ connection: 'OK', afip_status: statuses });
     } catch (e) {
        return res.status(500).json({ connection: 'ERROR', message: `ARCA respondió: ${e.message}` });
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
        
        // Datos mínimos para Factura C
        const data = {
          'CantReg': 1,
          'PtoVta': PUNTO_VENTA,
          'CbteTipo': 11, // Factura C (Monotributo)
          'Concepto': 1,  // Productos
          'DocTipo': orderData.docTipo || 99, // 99 es Consumidor Final (Sin DNI)
          'DocNro': parseInt(orderData.docNro || 0),
          'CbteDesde': 0, // Se autocompleta con getLastVoucher + 1
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

        // Obtenemos el último número emitido para autoincrementar
        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(PUNTO_VENTA, 11);
        data.CbteDesde = lastVoucher + 1;
        data.CbteHasta = lastVoucher + 1;

        // EJECUCION DE LA FACTURA EN ARCA
        const invoiceResponse = await afip.ElectronicBilling.createVoucher(data);

        // RESPUESTA EXITOSA: Guardamos en Supabase
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

        if (dbError) console.error("Error guardando en Supabase:", dbError);

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
    return res.status(500).json({ error: error.message || 'Error desconocido en AFIP' });
  }
}
