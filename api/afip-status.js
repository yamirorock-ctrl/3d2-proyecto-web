import { Afip } from 'afip-apis';

export default async function handler(req, res) {
  // Solo permitimos GET para este test
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cuit = process.env.VITE_AFIP_CUIT;
  const cert = process.env.VITE_AFIP_CERT;
  const key = process.env.VITE_AFIP_KEY;

  if (!cuit || !cert || !key) {
    return res.status(400).json({ 
        online: false, 
        message: 'Faltan credenciales en el servidor (.env)' 
    });
  }

  try {
    const afip = new Afip({
      key: key,
      cert: cert,
      cuit: cuit,
      production: false
    });

    const serverStatus = await afip.electronicBilling.getServerStatus();
    
    return res.status(200).json({ 
      online: true, 
      status: serverStatus,
      message: 'Conexión exitosa con AFIP'
    });
  } catch (err) {
    console.error('Error AFIP API:', err);
    return res.status(500).json({ 
      online: false, 
      error: err.message,
      message: 'Error de autenticación o servidores caídos'
    });
  }
}
