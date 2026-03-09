require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testV1() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        console.log("Probando gemini-1.5-flash con v1...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1' });
        const result = await model.generateContent("Hola");
        console.log("Respuesta v1:", result.response.text());
    } catch (e) {
        console.error("Error v1:", e.message);
    }
}

testV1();
