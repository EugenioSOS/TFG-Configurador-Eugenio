const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Endpoint para login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).send('Credenciales incorrectas');
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).send('Error interno');
  }
});

// Middleware JWT
const verifyToken = (req, res, next) => {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];

  if (!token) return res.status(403).send('Token no proporcionado');

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send('Token no válido');
    req.user = decoded;
    next();
  });
};

// Ruta protegida para obtener componentes
app.post('/api/getComponents', verifyToken, async (req, res) => {
  try {
    const { usage, budget } = req.body;

    const categories = [
      'Tarjeta Gráfica',
      'CPU',
      'Placa Base',
      'Memoria RAM',
      'Almacenamiento',
      'Disipador',
      'Fuente de Alimentación',
      'Caja'
    ];

    const components = [];

    for (const category of categories) {
      const result = await pool.query(
        `SELECT * FROM components WHERE LOWER(category) = LOWER($1) AND price <= $2 ORDER BY price ASC LIMIT 10`,
        [category, budget]
      );
      components.push(...result.rows);
    }

    res.json(components);
  } catch (error) {
    console.error('Error al obtener los componentes:', error);
    res.status(500).send('Error al obtener los componentes');
  }
});

// Iniciar servidor
app.listen(5000, () => {
  console.log('Servidor corriendo en http://localhost:5000');
});