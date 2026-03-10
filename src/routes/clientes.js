const { Router } = require('express');
const { listar, buscarPorCodigo, financeiro, criar } = require('../controllers/clienteController');

const router = Router();

router.get('/', listar);
router.get('/:codigo', buscarPorCodigo);
router.get('/:codigo/financeiro', financeiro);
router.post('/', criar);

module.exports = router;
