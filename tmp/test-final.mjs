import Afip from '@afipsdk/afip.js';
import fs from 'fs';

const CUIT = 20332866266;
const CERT = fs.readFileSync('3D2Store_1b73c1ea40df162.crt', 'utf8');
const KEY = fs.readFileSync('privada.key', 'utf8');

async function test() {
  try {
    console.log('--- TEST AFIP FINAL (CACHE LOCAL) ---');
    
    process.env.NODE_OPTIONS = '--tls-cipher-list=DEFAULT@SECLEVEL=1';
    
    const afip = new Afip({
      CUIT: CUIT,
      cert: CERT,
      key: KEY,
      production: true,
      res_folder: './tmp/'
    });

    process.env.TZ = 'America/Argentina/Buenos_Aires';
    if (afip.WSAA) afip.WSAA.url = "https://wsaa.arca.gob.ar/ws/services/LoginCms?wsdl";
    if (afip.ElectronicBilling) afip.ElectronicBilling.url = "https://serviciosweb.arca.gob.ar/wsfev1/service.asmx";

    const status = await afip.ElectronicBilling.getServerStatus();
    console.log('✅ ¡¡CONECTADO A ARCA!!');
    console.log('Respuesta:', JSON.stringify(status));
  } catch (error) {
    console.error('❌ AFIP/ARCA SIGUE DICIENDO 401 LUEGO DE LOS FIXES');
    console.error('Mensaje:', error.message);
    if(error.response) console.log('Data cruda:', error.response.data);
    console.log('\nSugerencia: Esperar 15 minutos a que AFIP procese el certificado nuevo.');
  }
}

test();
