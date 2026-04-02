const forge = require('node-forge');
const axios = require('axios');

export default async function handler(req, res) {
  try {
    const certRaw = process.env.AFIP_CERTIFICATE || '';
    const keyRaw = process.env.AFIP_PRIVATE_KEY || '';

    if (!certRaw || !keyRaw) {
      return res.status(200).json({ online: false, message: 'Faltan credenciales (Vercel ENV NULL)' });
    }

    // LIMPIEZA EXTREMA PARA VERCEL (Convierte el texto escapado en PEM real)
    const formatPEM = (raw, type) => {
      let cleaned = raw.trim().replace(/\\n/g, '\n');
      if (!cleaned.includes('-----BEGIN')) {
        const header = `-----BEGIN ${type}-----`;
        const footer = `-----END ${type}-----`;
        cleaned = `${header}\n${cleaned}\n${footer}`;
      }
      return cleaned;
    };

    const cert = formatPEM(certRaw, 'CERTIFICATE');
    const key = formatPEM(keyRaw, 'RSA PRIVATE KEY');

    // 1. Generar CMS (Firma)
    console.log('--- 🛡️ FIRMANDO TICKET DE ACCESO ---');
    const tra = `<?xml version="1.0" encoding="UTF-8"?>
    <loginTicketRequest version="1.0">
      <header>
        <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
        <generationTime>${new Date().toISOString()}</generationTime>
        <expirationTime>${new Date(Date.now() + 600000).toISOString()}</expirationTime>
      </header>
      <service>wsfe</service>
    </loginTicketRequest>`;

    let cms;
    try {
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(tra, 'utf8');
      p7.addCertificate(cert);
      p7.addSigner({
        key: forge.pki.privateKeyFromPem(key),
        certificate: forge.pki.certificateFromPem(cert),
        digestAlgorithm: forge.oids.sha256,
        authenticatedAttributes: [
          { type: forge.oids.contentType, value: forge.oids.data },
          { type: forge.oids.messageDigest },
          { type: forge.oids.signingTime }
        ]
      });
      p7.sign();
      cms = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
      console.log('✅ FIRMA CMS GENERADA');
    } catch (signErr) {
      return res.status(200).json({ 
        online: false, 
        message: 'Fallo al firmar con Private Key', 
        detail: signErr.message 
      });
    }

    // 2. Comunicar con AFIP (Intento en Producción Real)
    console.log('--- 🚀 LLAMANDO AD AFIP WSAA PROD ---');
    const soapMsg = `<?xml version="1.0" encoding="UTF-8"?>
    <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://wsaa.afip.gov.ar/ws/services/LoginCms">
      <SOAP-ENV:Body><ns1:loginCms><ns1:in0>${cms}</ns1:in0></ns1:loginCms></SOAP-ENV:Body>
    </SOAP-ENV:Envelope>`;

    const response = await axios.post('https://wsaa.afip.gov.ar/ws/services/LoginCms', soapMsg, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
      timeout: 15000
    });

    if (response.data.includes('token')) {
      return res.status(200).json({ online: true, message: '¡Handshake Exitoso!' });
    } else if (response.data.includes('error')) {
      return res.status(200).json({ online: false, message: 'AFIP rechazó credenciales', detail: response.data.substring(0, 200) });
    } else {
      return res.status(200).json({ online: false, message: 'Respuesta inesperada de AFIP' });
    }

  } catch (err) {
    console.error('ERROR AFIP API:', err.message);
    return res.status(200).json({ 
      online: false, 
      message: 'Fallo Handshake AFIP',
      detail: err.message
    });
  }
}
