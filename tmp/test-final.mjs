import Afip from '@afipsdk/afip.js';
import fs from 'fs';

const CUIT = 20332866266;
const CERT = fs.readFileSync('3D2Store_1b73c1ea40df162.crt', 'utf8');
const KEY = fs.readFileSync('privada.key', 'utf8');

async function test() {
  try {
    console.log('--- TEST AFIP FINAL (CACHE LOCAL) ---');
    
    const afip = new Afip({
      CUIT: CUIT,
      cert: CERT,
      key: KEY,
      production: true,
      res_folder: './tmp/' // Usamos la carpeta local tmp que sí existe
    });

    const status = await afip.ElectronicBilling.getServerStatus();
    console.log('✅ ¡¡CONECTADO!!');
    console.log('Respuesta:', JSON.stringify(status));
  } catch (error) {
    console.error('❌ AFIP SIGUE DICIENDO 401');
    console.error('Mensaje:', error.message);
    console.log('\nSugerencia: Esperar 15 minutos a que AFIP procese el certificado nuevo.');
  }
}

test();
