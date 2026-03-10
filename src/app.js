const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globais
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'OnixSistemas API', version: '1.0.0' });
});

// Rotas da API
app.use('/api/v1', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// Handler de erros global
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 OnixSistemas API rodando em http://localhost:${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   POST   /api/v1/auth/login`);
  console.log(`   GET    /api/v1/clientes`);
  console.log(`   GET    /api/v1/clientes/:codigo`);
  console.log(`   GET    /api/v1/clientes/:codigo/financeiro`);
  console.log(`   POST   /api/v1/clientes`);
  console.log(`   GET    /api/v1/pedidos`);
  console.log(`   GET    /api/v1/pedidos/:pedido`);
  console.log(`   POST   /api/v1/pedidos`);
  console.log(`   PUT    /api/v1/pedidos/:pedido/status`);
  console.log(`   GET    /api/v1/produtos`);
  console.log(`   GET    /api/v1/produtos/:codigo`);
  console.log(`   GET    /api/v1/produtos/:codigo/precos`);
  console.log(`   GET    /api/v1/produtos/:codigo/estoque`);
  console.log(`   GET    /api/v1/produtos/tabelas`);
  console.log(`   GET    /api/v1/produtos/condicoes`);
});

module.exports = app;
