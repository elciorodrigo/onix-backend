const { Router } = require('express');
const {
  listar, buscarPorCodigo, precos, estoque, tabelasPreco, condicoes
} = require('../controllers/produtoController');

const router = Router();

router.get('/', listar);
router.get('/tabelas', tabelasPreco);
router.get('/condicoes', condicoes);
router.get('/:codigo', buscarPorCodigo);
router.get('/:codigo/precos', precos);
router.get('/:codigo/estoque', estoque);

module.exports = router;
