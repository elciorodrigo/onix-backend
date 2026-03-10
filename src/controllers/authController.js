const jwt = require('jsonwebtoken');
const db = require('../config/database');

const login = async (req, res, next) => {
  try {
    const { usuario, senha } = req.body;
    if (!usuario || !senha)
      return res.status(400).json({ error: 'Usuario e senha sao obrigatorios.' });

    const [rows] = await db.query(
      'SELECT * FROM afv_tbpalmusers WHERE UPPER(USUARIO) = UPPER(?) LIMIT 1',
      [usuario]
    );
    if (rows.length === 0)
      return res.status(401).json({ error: 'Usuario ou senha invalidos.' });

    const user = rows[0];
    if (String(user.SENHA).trim() !== String(senha).trim())
      return res.status(401).json({ error: 'Usuario ou senha invalidos.' });

    const payload = {
      usuario: user.USUARIO,
      nome: user.NOME || user.USUARIO,
      empresa: Number(user.EMPRESA),
      funcionario: Number(user.FUNCIONARIO),
      tabela: Number(user.TABELA),
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
    res.json({ token, usuario: payload });
  } catch (err) { next(err); }
};

const me = async (req, res) => res.json({ usuario: req.user });

module.exports = { login, me };
