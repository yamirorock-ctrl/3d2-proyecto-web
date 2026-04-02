const forge = require('node-forge');
const axios = require('axios');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const certRaw = process.env.AFIP_CERTIFICATE || '';
    const keyRaw = process.env.AFIP_PRIVATE_KEY || '';

    if (!certRaw || !keyRaw) {
      return res.status(200).json({ online: false, message: 'Credenciales faltantes' });
    }

    const decodePEM = (raw, type) => {
      let c = raw.trim().split('\\\\n').join('\n').split('\\n').join('\n');
      if (!c.includes('-----BEGIN')) {
        c = `-----BEGIN ${type}-----\n${c}\n-----END ${type}-----`;
      }
      return c;
    };

    const cert = decodePEM(certRaw, 'CERTIFICATE');
    const key = decodePEM(keyRaw, 'RSA PRIVATE KEY');

    // AJUSTE DE RELOJ: AFIP rechaza tickets generados en el "futuro"
    // Ponemos el tick 1 minuto atrás para evitar desincronización de Vercel
    const now = new Date();
    const genTime = new Date(now.getTime() - 60000).toISOString().replace(/\.\d+Z$/, '');
    const expTime = new Date(now.getTime() + 600000).toISOString().replace(/\.\d+Z$/, '');

    const tra = `<?xml version="1.0" encoding="UTF-8"?>
    <loginTicketRequest version="1.0">
      <header>
        <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
        <generationTime>${genTime}</generationTime>
        <expirationTime>${expTime}</expirationTime>
      </header>
      <service>wsfe</service>
    </loginTicketRequest>`;

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(tra, 'utf8');
    p7.addCertificate(cert);
    p7.addSigner({
      key: forge.pki.privateKeyFromPem(key),
      certificate: forge.pki.certificateFromPem(cert),
      digestAlgorithm: forge.oids.sha256,
      authenticatedAttributes: [{ type: forge.oids.contentType, value: forge.oids.data }, { type: forge.oids.messageDigest }, { type: forge.oids.signingTime }]
    });
    p7.sign();
    const cms = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());

    const soapMsg = `<?xml version="1.0" encoding="UTF-8"?>
    <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://wsaa.afip.gov.ar/ws/services/LoginCms">
      <SOAP-ENV:Body><ns1:loginCms><ns1:in0>${cms}</ns1:in0></ns1:loginCms></SOAP-ENV:Body>
    </SOAP-ENV:Envelope>`;

    const response = await axios.post('https://wsaa.afip.gov.ar/ws/services/LoginCms', soapMsg, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 15000
    });

    if (response.data.includes('token')) {
      return res.status(200).json({ online: true, message: '¡CONEXIÓN EXITOSA!' });
    } else {
      const fault = response.data.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] || 'AFIP Falló';
      return res.status(200).json({ online: false, message: 'AFIP Rechazó Ticket', detail: fault });
    }

  } catch (err) {
    // Si Axios falla, capturamos el XML de error real de AFIP si está disponible
    const afipError = err.response?.data ? String(err.response.data) : err.message;
    return res.status(200).json({ 
      online: false, 
      message: 'Error de Red con AFIP', 
      detail: afipError.includes('faultstring') ? afipError.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] : afipError
    });
  }
}
