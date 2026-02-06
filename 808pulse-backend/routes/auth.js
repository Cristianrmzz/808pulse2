const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const router = express.Router();

async function ensureDefaultAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || '808pulse-admin';
  const role = 'superadmin';
  const existing = await AdminUser.findOne({ where: { username } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await AdminUser.create({ username, passwordHash, role });
    console.log(`[AUTH] Usuario admin por defecto creado: ${username}`);
  }
}

ensureDefaultAdmin().catch(err => console.error('[AUTH] Error creando admin por defecto:', err));

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y clave son requeridos' });
    }
    const user = await AdminUser.findOne({ where: { username } });
    if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('[AUTH] Error en login:', err);
    res.status(500).json({ message: 'Error de autenticación' });
  }
});

router.get('/me', (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No autorizado' });
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    res.json({ user: payload });
  } catch (err) {
    res.status(401).json({ message: 'Token inválido' });
  }
});

module.exports = router;
