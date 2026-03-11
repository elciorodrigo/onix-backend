const { Router } = require('express');
const authRouter = require('./auth');
const clientesRouter = require('./clientes');
const pedidosRouter = require('./pedidos');
const produtosRouter = require('./produtos');
const syncRouter = require('./sync');
const authMiddleware = require('../middleware/auth');

const router = Router();

// Rotas públicas
router.use('/auth', authRouter);

// Rotas protegidas por JWT
router.use('/clientes', authMiddleware, clientesRouter);
router.use('/pedidos', authMiddleware, pedidosRouter);
router.use('/produtos', authMiddleware, produtosRouter);
router.use('/sync', authMiddleware, syncRouter);

module.exports = router;
