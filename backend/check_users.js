require("dotenv").config();
const db = require("./services/db");

async function checkUsers() {
    try {
        console.log("=== LISTADO DE USUARIOS EN LA BASE DE DATOS ===");
        const result = await db.query("SELECT id, name, email, password_hash FROM users");
        if (result.rows.length === 0) {
            console.log("No hay usuarios registrados.");
        } else {
            console.table(result.rows.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                hash: user.password_hash ? user.password_hash.substring(0, 20) + "..." : "SIN CONTRASEÑA"
            })));
        }
        process.exit(0);
    } catch (error) {
        console.error("Error al consultar usuarios:", error);
        process.exit(1);
    }
}

checkUsers();
