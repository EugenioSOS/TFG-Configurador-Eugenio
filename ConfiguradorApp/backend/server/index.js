const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const { runScraperAndInsert } = require('./scraper/partpicker.js');

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.post('/api/register',
  body('username').isLength({ min: 3 }),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    try {
      const result = await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
        [username, hashed]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(400).json({ error: 'Usuario ya existe' });
    }
  }
);

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  if (user.rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

  const valid = await bcrypt.compare(password, user.rows[0].password);
  if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign({ id: user.rows[0].id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

app.get('/api/components', authenticateToken, async (req, res) => {
  const result = await pool.query('SELECT * FROM components');
  res.json(result.rows);
});

app.post('/api/admin/fetch-components', authenticateToken, async (req, res) => {
  try {
    const { category = 'all', search = '', limit = 10 } = req.body;
    await runScraperAndInsert(category, search, limit);
    res.json({ status: 'Componentes importados con éxito' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar datos del scraper' });
  }
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});