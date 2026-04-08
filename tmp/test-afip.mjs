import dotenv from 'dotenv';
import Afip from '@afipsdk/afip.js';

dotenv.config({ path: '.env.local' });

const cleanKey = (key) => {
  if (!key) return '';
  return key.toString().replace(/["']/g, '').replace(/\\n/g, '\n').trim();
};

const cleanCUIT = (cuit) => {
  if (!cuit) return null;
  const cleaned = cuit.toString().replace(/[-"'\s]/g, '').trim();
  return cleaned ? parseInt(cleaned) : null;
};

const CUIT = cleanCUIT(process.env.VITE_AFIP_CUIT || process.env.AFIP_CUIT);
const CERT = cleanKey(process.env.AFIP_CERTIFICATE);
const KEY = cleanKey(process.env.AFIP_PRIVATE_KEY);

async function test() {
  try {
    const afip = new Afip({
      CUIT: CUIT,
      cert: CERT,
      key: KEY,
      production: true
    });

    console.log('--- TEST AFIP DETALLADO ---');
    console.log('CUIT:', CUIT);
    
    const status = await afip.ElectronicBilling.getServerStatus();
    console.log('✅ ÉXITO:', JSON.stringify(status));
  } catch (error) {
    console.error('❌ ERROR DETALLADO:');
    console.error('Mensaje:', error.message);
    if (error.response) {
       console.error('Data:', error.response.data);
    } else {
       console.error('Objeto Error:', error);
    }
  }
}

test();
