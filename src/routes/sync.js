const { Router } = require('express');
const { 
  pull, push, status, info, check,
  pullMetadata, pullClientes, pullProdutos, pullPrecos, pullCounts, pullPedidos 
} = require('../controllers/syncController');

const router = Router();

/**
 * Rotas de Sincronização
 * Todas requerem autenticação (aplicada no index.js)
 */

// Verificação rápida de alterações
router.get('/check', check);              // Verifica se há alterações (checksums)

// Endpoints paginados (recomendados para grandes volumes)
router.get('/pull/counts', pullCounts);       // Totais para calcular progresso
router.get('/pull/metadata', pullMetadata);   // Tabelas, condições (pequeno)
router.get('/pull/clientes', pullClientes);   // Clientes paginados
router.get('/pull/produtos', pullProdutos);   // Produtos paginados
router.get('/pull/precos', pullPrecos);       // Preços paginados
router.get('/pull/pedidos', pullPedidos);     // Pedidos do vendedor (com itens)

// GET /sync/pull - Baixa todos os dados de uma vez (legado)
router.get('/pull', pull);

// POST /sync/push - Envia pedidos criados offline
router.post('/push', push);

// GET /sync/status - Verifica status de pedidos enviados
router.get('/status', status);

// GET /sync/info - Informações e estatísticas
router.get('/info', info);

module.exports = router;
