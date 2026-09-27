// controllers/auth.controller.js
const prisma = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

// POST /api/register  { username, email, password }
async function registrar(req, res) {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password)
      return res.status(400).json({ error: 'Faltan datos (username, email, password)' });
    if (password.length < 6)
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    // ¿ya existe ese usuario o email?
    const existe = await prisma.usuarios.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existe) return res.status(409).json({ error: 'El usuario o email ya existe' });

    // hash de la contraseña (NUNCA texto plano)
    const password_hash = await bcrypt.hash(password, 10);

    const usuario = await prisma.usuarios.create({
      data: { username, email, password_hash },
      select: { id: true, username: true, email: true },
    });

    res.status(201).json({ mensaje: 'Usuario creado', usuario });
  } catch (err) {
    console.error('Error registrar:', err);
    res.status(500).json({ error: 'Error al registrar el usuario' });
  }
}

// POST /api/login  { username, password }
async function login(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: 'Faltan usuario o contraseña' });

    const usuario = await prisma.usuarios.findUnique({ where: { username } });
    if (!usuario) return res.status(401).json({ error: 'Credenciales incorrectas' });

    // comparar contra el hash
    const valido = await bcrypt.compare(password, usuario.password_hash);
    if (!valido) return res.status(401).json({ error: 'Credenciales incorrectas' });

    // firmar token (caduca en 8h)
    const token = jwt.sign(
      { id: usuario.id, username: usuario.username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, usuario: { id: usuario.id, username: usuario.username } });
  } catch (err) {
    console.error('Error login:', err);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
}

module.exports = { registrar, login };