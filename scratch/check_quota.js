import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testChatFull() {
    const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // CONFIGURACIÓN EXACTA DE TU APP
    const modelName = "gemini-3.1-pro-preview";
    
    console.log(`--- TEST DE CHAT ESTRUCTURADO ---`);
    
    try {
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            systemInstruction: "Eres VANGUARD, el Socio Estratégico Senior de 3D2 Store."
        });

        // Simular historial como lo hace ml-manager.js
        const mockHistory = [
            { role: "user", parts: [{ text: "Hola Vanguard" }] },
            { role: "model", parts: [{ text: "Hola, ¿en qué puedo ayudarte hoy?" }] }
        ];

        const chat = model.startChat({ history: mockHistory });
        const result = await chat.sendMessage("¿Qué tal van las ventas?");
        const response = await result.response;
        
        console.log("✅ ÉXITO TOTAL: El chat respondió correctamente con instrucciones de sistema.");
        console.log("Vanguard dice:", response.text());
    } catch (error) {
        console.log("❌ FALLO EN EL CHAT:");
        console.log("Error:", error.message);
        
        if (error.message.includes("systemInstruction")) {
            console.log("\n⚠️ CONCLUSIÓN: El modelo '" + modelName + "' no parece soportar 'systemInstruction' con esta sintaxis específica.");
        }
    }
}

testChatFull();
