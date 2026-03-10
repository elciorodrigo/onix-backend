module.exports = (err, req, res, next) => {
  console.error('❌ Erro:', err.message);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Registro duplicado.' });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Referência inválida.' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor.',
  });
};
