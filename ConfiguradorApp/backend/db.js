const { Pool } = require('pg');
require('dotenv').config();  // Cargar las variables de entorno desde el archivo .env

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,          // Usuario de PostgreSQL
  host: process.env.DB_HOST,          // Dirección del servidor de PostgreSQL
  database: process.env.DB_NAME,      // Nombre de la base de datos
  password: process.env.DB_PASSWORD,  // Contraseña del usuario
  port: process.env.DB_PORT || 5432,  // Puerto de PostgreSQL (5432 por defecto)
});

// Función para conectarse a la base de datos
const connectToDatabase = async () => {
  try {
    const client = await pool.connect();  // Obtener una conexión del pool
    console.log('Conexión exitosa a PostgreSQL');
    return client;  // Retornar el cliente de la base de datos
  } catch (err) {
    console.error('Error de conexión a PostgreSQL:', err);
    throw err;  // Lanzar el error para que pueda ser manejado
  }
};

module.exports = connectToDatabase;