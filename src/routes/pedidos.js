const { Router } = require('express');
const { listar, buscarPorNumero, criar, atualizar, atualizarStatus, relatorio } = require('../controllers/pedidoController');

const router = Router();

router.get('/', listar);
router.get('/relatorio', relatorio);
router.get('/:pedido', buscarPorNumero);
router.post('/', criar);
router.put('/:pedido', atualizar);
router.put('/:pedido/status', atualizarStatus);

module.exports = router;
