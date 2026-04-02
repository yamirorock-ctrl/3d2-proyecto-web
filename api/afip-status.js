const forge = require('node-forge');
const axios = require('axios');

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  try {
    const certRaw = process.env.AFIP_CERTIFICATE || '';
    const keyRaw = process.env.AFIP_PRIVATE_KEY || '';

    if (!certRaw || !keyRaw) return res.json({ online: false, message: 'Credenciales NULL' });

    const decodePEM = (raw, type) => {
      let c = raw.trim().split('\\\\n').join('\n').split('\\n').join('\n');
      if (!c.includes('-----BEGIN')) c = `-----BEGIN ${type}-----\n${c}\n-----END ${type}-----`;
      return c;
    };

    const cert = decodePEM(certRaw, 'CERTIFICATE');
    const key = decodePEM(keyRaw, 'RSA PRIVATE KEY');

    const tra = `<?xml version="1.0" encoding="UTF-8"?>
    <loginTicketRequest version="1.0">
      <header>
        <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
        <generationTime>${new Date(Date.now() - 60000).toISOString().replace(/\.\d+Z$/, '')}</generationTime>
        <expirationTime>${new Date(Date.now() + 600000).toISOString().replace(/\.\d+Z$/, '')}</expirationTime>
      </header>
      <service>wsfe</service>
    </loginTicketRequest>`;

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(tra, 'utf-8');
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

    // PROBAR 2 SERVIDORES (Prod y Homo)
    const endpoints = [
      'https://wsaa.afip.gov.ar/ws/services/LoginCms',
      'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'
    ];

    let resultMsg = 'AFIP Fuera de Línea';
    let detailMsg = 'Error en servidores AFIP (DIP/IP Blocked?)';
    
    for (const url of endpoints) {
       try {
         const resp = await axios.post(url, soapMsg, { headers: { 'Content-Type': 'text/xml' }, timeout: 8000 });
         if (resp.data.includes('token')) {
           return res.json({ online: true, message: `¡CONECTADO! (${url.includes('homo') ? 'TEST' : 'PROD'})` });
         } else {
           detailMsg = resp.data.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] || 'Error en Credencial';
         }
       } catch (e) {
          console.error(`Fallo en ${url}:`, e.message);
       }
    }

    res.json({ online: false, message: resultMsg, detail: detailMsg });

  } catch (err) {
    res.json({ online: false, message: 'Fallo Handshake', detail: err.message });
  }
}
