require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        // The SDK doesn't have a direct listModels, we have to use the fetch version or just guess.
        // But we can try to use a known working model.
        console.log("Probgando gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hola");
        console.log("Respuesta:", result.response.text());
    } catch (e) {
        console.error("Error con gemini-1.5-flash:", e.message);
    }
}

listModels();
