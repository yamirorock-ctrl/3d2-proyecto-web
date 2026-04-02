const forge = require('node-forge');
const axios = require('axios');

export default async function handler(req, res) {
  try {
    const certRaw = process.env.AFIP_CERTIFICATE || '';
    const keyRaw = process.env.AFIP_PRIVATE_KEY || '';

    if (!certRaw || !keyRaw) {
      return res.status(200).json({ online: false, message: 'Faltan credenciales PEM en Vercel' });
    }

    // DECODIFICADOR ULTRA-ROBUSTO (Blindaje contra Vercel String Escaping)
    const decodeVercelPEM = (raw, type) => {
      // 1. Limpiar espacios y comillas accidentales
      let cleaned = raw.trim();
      // 2. Convertir la doble barra \\n (que vimos en el espía) en un salto de línea real \n
      cleaned = cleaned.split('\\\\n').join('\n').split('\\n').join('\n');
      
      // 3. Si no tiene el formato PEM, forzarlo (Protección extra)
      if (!cleaned.includes('-----BEGIN')) {
        const header = `-----BEGIN ${type}-----`;
        const footer = `-----END ${type}-----`;
        cleaned = `${header}\n${cleaned}\n${footer}`;
      }
      return cleaned;
    };

    const cert = decodeVercelPEM(certRaw, 'CERTIFICATE');
    const key = decodeVercelPEM(keyRaw, 'RSA PRIVATE KEY');

    // TEST DE FIRMA (Diagnóstico Interno)
    const tra = `<?xml version="1.0" encoding="UTF-8"?>
    <loginTicketRequest version="1.0">
      <header>
        <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
        <generationTime>${new Date().toISOString()}</generationTime>
        <expirationTime>${new Date(Date.now() + 600000).toISOString()}</expirationTime>
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

    // CONSULTA A AFIP PRODUCCIÓN
    const soapMsg = `<?xml version="1.0" encoding="UTF-8"?>
    <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://wsaa.afip.gov.ar/ws/services/LoginCms">
      <SOAP-ENV:Body><ns1:loginCms><ns1:in0>${cms}</ns1:in0></ns1:loginCms></SOAP-ENV:Body>
    </SOAP-ENV:Envelope>`;

    const response = await axios.post('https://wsaa.afip.gov.ar/ws/services/LoginCms', soapMsg, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 10000
    });

    if (response.data.includes('token')) {
      return res.status(200).json({ online: true, message: '¡CONEXIÓN EXITOSA!' });
    } else {
      const fault = response.data.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] || 'Error en AFIP';
      return res.status(200).json({ online: false, message: 'AFIP Rechazó Credenciales', detail: fault });
    }

  } catch (err) {
    return res.status(200).json({ 
      online: false, 
      message: 'Fallo Handshake Proceso',
      detail: err.message
    });
  }
}
