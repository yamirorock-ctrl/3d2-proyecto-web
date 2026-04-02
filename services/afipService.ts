import Afip from '@afipsdk/afip.js';

// Cargar variables de entorno (CUIT, CERT, KEY) de .env.local
const AFIP_CUIT = "20332866266"; // Hardcodeado temporalmente para el service si falla el .env

/**
 * Servicio de facturación electrónica de AFIP (Nativo 3D2)
 */
export const afipService = {
  
  getAfip() {
    return new Afip({
      access_token: process.env.VITE_AFIP_ACCESS_TOKEN || "",
      CUIT: parseInt(process.env.VITE_AFIP_CUIT || AFIP_CUIT),
      cert: process.env.VITE_AFIP_CERT || "",
      key: process.env.VITE_AFIP_KEY || "",
      production: false
    });
  },

  async getServerStatus() {
    try {
        const afip = this.getAfip();
        const status = await afip.ElectronicBilling.getServerStatus();
        return status;
    } catch (e) {
        console.error('Error AFIP Status:', e);
        return null;
    }
  },

  async getLastVoucher(ptovta: number, cbte: number) {
    try {
        const afip = this.getAfip();
        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptovta, cbte);
        return lastVoucher;
    } catch (e) {
        console.error('Error AFIP LastVoucher:', e);
        return null;
    }
  }
};
