import Afip from '@afipsdk/afip.js';
import fs from 'fs';

const CUIT = 20332866266;
const CERT = fs.readFileSync('3D2Store_1b73c1ea40df162.crt', 'utf8');
const KEY = fs.readFileSync('privada.key', 'utf8');

async function test() {
  try {
    console.log('--- TEST AFIP LECTURA DIRECTA ---');
    
    // Forzamos la inicialización con los archivos frescos del disco
    const afip = new Afip({
      CUIT: CUIT,
      cert: CERT,
      key: KEY,
      production: true
    });

    const status = await afip.ElectronicBilling.getServerStatus();
    console.log('✅ ¡ÉXITO TOTAL!');
    console.log('Estado:', JSON.stringify(status));
  } catch (error) {
    console.error('❌ ERROR SIGUE PERSISTIENDO');
    console.error('Mensaje:', error.message);
  }
}

test();
