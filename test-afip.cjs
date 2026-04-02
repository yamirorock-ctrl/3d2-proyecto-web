require('dotenv').config({ path: '.env.local' });
const Afip = require('@afipsdk/afip.js');

async function run() {
    console.log("🔄 Probando conexion con @afipsdk/afip.js...");
    try {
        const afip = new Afip({
            CUIT: parseInt(process.env.VITE_AFIP_CUIT),
            cert: process.env.VITE_AFIP_CERT,
            key: process.env.VITE_AFIP_KEY,
            production: false
        });

        console.log("📡 Consultando el estado de los servidores de AFIP...");
        const status = await afip.ElectronicBilling.getServerStatus();
        console.log("✅ EXITO: Servidores AFIP OK:", JSON.stringify(status, null, 2));

    } catch (err) {
        console.error("❌ ERROR AFIP:", err.message || err);
        if (err.response) {
            console.error("💡 Detalle de AFIP:", err.response.data);
        }
    }
}

run();
