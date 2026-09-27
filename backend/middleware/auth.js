// middleware/auth.js
// Verifica el token JWT del header Authorization: Bearer <token>.
// Protege endpoints: si el token es valido, deja pasar; si no, 401.
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cambia_esto_en_el_env';

function verificarToken(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload;   // { id, username }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token no valido o caducado' });
  }
}

module.exports = { verificarToken, JWT_SECRET };