import pkg from 'afip-apis';
import dotenv from 'dotenv';
const { Afip } = pkg;

dotenv.config({ path: '.env.local' });

async function testLib() {
    console.log("🔄 Iniciando Test con ESM flexible...");
    
    try {
        const afip = new Afip({
            key: process.env.VITE_AFIP_KEY,
            cert: process.env.VITE_AFIP_CERT,
            cuit: process.env.VITE_AFIP_CUIT,
            production: false
        });

        console.log("📡 Consultando el estado de los servidores de AFIP...");
        const status = await afip.electronicBilling.getServerStatus();
        console.log("✅ EXITO: Servidores AFIP OK:", JSON.stringify(status, null, 2));

        const points = await afip.electronicBilling.getSalesPoints();
        console.log("📦 Puntos de Venta Autorizados:", JSON.stringify(points, null, 2));

    } catch (err) {
        console.error("❌ ERROR AFIP:", err.message || err);
    }
}

testLib();
