require("dotenv").config();
const db = require("./services/db");

async function deleteUserByEmail(email) {
    try {
        console.log(`Intentando eliminar al usuario: ${email}`);
        const result = await db.query("DELETE FROM users WHERE email = $1", [email]);
        if (result.rowCount === 0) {
            console.log(`No se encontró ningún usuario con el email: ${email}`);
        } else {
            console.log(`Usuario ${email} eliminado correctamente (${result.rowCount} fila(s) afectada(s)).`);
        }
        process.exit(0);
    } catch (error) {
        console.error("Error al eliminar el usuario:", error);
        process.exit(1);
    }
}

const emailToDelete = process.argv[2] || 'fernan.pry@gmail.com';
deleteUserByEmail(emailToDelete);
