require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testFlashLatest() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        console.log("Probando gemini-flash-latest...");
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent("Hola");
        console.log("Respuesta:", result.response.text());
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testFlashLatest();
