import Afip from '@afipsdk/afip.js';
import fs from 'fs';

// Cargamos los archivos directos para no tener dudas de formato
const CUIT = 20332866266;
const CERT = fs.readFileSync('3D2Store_1b73c1ea40df162.crt', 'utf8');
const KEY = fs.readFileSync('privada.key', 'utf8');

async function debugMaximo() {
  console.log('--- DEBUG MAXIMO AFIP ---');
  console.log('Hora local:', new Date().toISOString());
  
  const afip = new Afip({
    CUIT: CUIT,
    cert: CERT,
    key: KEY,
    production: true,
    res_folder: './tmp/'
  });

  try {
    console.log('1. Intentando autenticación con WSAA...');
    // Esta es la parte que suele dar el 401
    const token = await afip.getServiceToken('wsfe');
    console.log('✅ TOKEN OBTENIDO:', token.substring(0, 20) + '...');
    
    console.log('2. Intentando consulta de estado...');
    const status = await afip.ElectronicBilling.getServerStatus();
    console.log('✅ RESULTADO FINAL:', JSON.stringify(status));

  } catch (error) {
    console.error('❌ FALLO CRÍTICO EN PASO:', error.message);
    
    if (error.response && error.response.data) {
        console.error('--- DETALLE DE AFIP ---');
        console.error(error.response.data);
    }
    
    console.log('\n--- POSIBLES CAUSAS ---');
    if (error.message.includes('401')) {
       console.log('1. AFIP todavía no propagó tu certificado (puede tardar 1 hora).');
       console.log('2. El CUIT 20332866266 no coincide con el del certificado.');
       console.log('3. El alias 3D2Store no tiene delegado el servicio WSFE (Factura Electrónica).');
    }
  }
}

debugMaximo();
