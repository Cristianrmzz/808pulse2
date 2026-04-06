const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No autorizado' });

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = payload; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  next();
}

module.exports = { authRequired, adminOnly };
