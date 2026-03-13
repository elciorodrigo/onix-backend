const db = require('../config/database');

const PAGE_SIZE = 1000; // Registros por página

/**
 * GET /sync/pull/metadata
 * Retorna dados pequenos: tabelas, condições, formas de pagamento
 */
const pullMetadata = async (req, res, next) => {
  try {
    const empresa = req.user.empresa;

    // Tabelas de preço (com todos os campos relevantes)
    const [tabelas] = await db.query(
      `SELECT tabela AS codigo, descricao, estado, contribuinte,
              limite_desconto, limite_acrescimo, data_inicial, data_final
       FROM afv_tbtabela 
       WHERE empresa = ? 
       ORDER BY descricao`,
      [empresa]
    );

    // Condições de pagamento (com forma de pagamento)
    const [condicoes] = await db.query(
      `SELECT condicao AS codigo, descricao, medio AS prazo_medio, 
              formapagamento AS forma_pagamento,
              CASE WHEN palm = 'S' THEN 1 ELSE 0 END AS ativo
       FROM afv_tbcondicao 
       WHERE empresa = ? 
       ORDER BY descricao`,
      [empresa]
    );

    // Formas de pagamento (tabela global, sem empresa)
    const [formasPagamento] = await db.query(
      `SELECT formapagamentoid AS codigo, descricao 
       FROM afv_tbformapagamento 
       ORDER BY descricao`
    );

    res.json({
      success: true,
      data: {
        tabelas_preco: tabelas,
        condicoes_pagamento: condicoes,
        formas_pagamento: formasPagamento,
      },
      counts: {
        tabelas: tabelas.length,
        condicoes: condicoes.length,
        formas_pagamento: formasPagamento.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sync/pull/clientes?page=1&limit=1000
 * Retorna clientes paginados (filtrados por vendedor)
 */
const pullClientes = async (req, res, next) => {
  try {
    const { page = 1, limit = PAGE_SIZE } = req.query;
    const empresa = req.user.empresa;
    const vendedor = req.user.funcionario;
    const offset = (page - 1) * limit;

    // Total de clientes (do vendedor + sem vendedor atribuído)
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbcadastro WHERE empresa = ? AND funcionario IN (0, ?)',
      [empresa, vendedor]
    );

    // Clientes paginados (do vendedor + sem vendedor)
    const [clientes] = await db.query(`
      SELECT codigo, razao, fantasia, cnpj_cpf, ie_rg,
             fone_01 AS telefone, cel_01 AS celular, email_01 AS email,
             dsc_cidade AS cidade_descricao, uf AS estado, cep,
             logradouro, numero, bairro, complemento, observacao,
             restricao, limite_credito AS limite, tabelapreco_id, condicao,
             seguimento, regime, link
      FROM afv_tbcadastro 
      WHERE empresa = ? AND funcionario IN (0, ?)
      ORDER BY razao
      LIMIT ? OFFSET ?
    `, [empresa, vendedor, Number(limit), Number(offset)]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: clientes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sync/pull/produtos?page=1&limit=1000
 * Retorna produtos paginados com preço da tabela do vendedor
 */
const pullProdutos = async (req, res, next) => {
  try {
    const { page = 1, limit = PAGE_SIZE } = req.query;
    const empresa = req.user.empresa;
    const tabelaPreco = req.user.tabela;
    const offset = (page - 1) * limit;

    // Total de produtos
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbproduto WHERE empresa = ?',
      [empresa]
    );

    // Produtos paginados com preço (JOIN correto por produto + produtoref + tabela)
    const [produtos] = await db.query(`
      SELECT pr.produto AS codigo, pr.descricao, pr.especificacao AS codigoean,
             pr.unidade, pr.pd_saldo AS estoque, pr.grupo, pr.produtoref,
             COALESCE(pc.preco, 0) AS preco, COALESCE(pc.promocao, 'N') AS promocao
      FROM afv_tbproduto pr
      LEFT JOIN afv_tbpreco pc ON pc.produto = pr.produto 
        AND pc.produtoref = pr.produtoref
        AND pc.empresa = pr.empresa 
        AND pc.tabela = ?
      WHERE pr.empresa = ?
      ORDER BY pr.descricao
      LIMIT ? OFFSET ?
    `, [tabelaPreco, empresa, Number(limit), Number(offset)]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: produtos,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sync/pull/precos?page=1&limit=1000
 * Retorna preços paginados (todas as tabelas)
 */
const pullPrecos = async (req, res, next) => {
  try {
    const { page = 1, limit = PAGE_SIZE } = req.query;
    const empresa = req.user.empresa;
    const offset = (page - 1) * limit;

    // Total de preços
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbpreco WHERE empresa = ?',
      [empresa]
    );

    // Preços paginados (inclui produtoref para identificar preço corretamente)
    const [precos] = await db.query(`
      SELECT p.produto AS produto_codigo, p.produtoref,
             p.tabela AS tabelapreco_id, 
             t.descricao AS dsc_tabelapreco,
             t.limite_desconto, t.limite_acrescimo,
             p.preco, p.preco2 AS preco_minimo, p.promocao
      FROM afv_tbpreco p
      LEFT JOIN afv_tbtabela t ON t.tabela = p.tabela AND t.empresa = p.empresa
      WHERE p.empresa = ?
      ORDER BY p.produto, p.produtoref, t.descricao
      LIMIT ? OFFSET ?
    `, [empresa, Number(limit), Number(offset)]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: precos,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sync/pull/counts
 * Retorna totais para calcular progresso
 */
const pullCounts = async (req, res, next) => {
  try {
    const empresa = req.user.empresa;
    const vendedor = req.user.funcionario;

    const [[clientesCount]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbcadastro WHERE empresa = ? AND funcionario IN (0, ?)',
      [empresa, vendedor]
    );

    const [[produtosCount]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbproduto WHERE empresa = ?',
      [empresa]
    );

    const [[precosCount]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbpreco WHERE empresa = ?',
      [empresa]
    );

    const [[pedidosCount]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_pedido WHERE CODIGO_VENDEDOR = ?',
      [vendedor]
    );

    res.json({
      success: true,
      counts: {
        clientes: clientesCount.total,
        produtos: produtosCount.total,
        precos: precosCount.total,
        pedidos: pedidosCount.total,
      },
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /sync/pull (LEGADO - mantido para compatibilidade)
 * Retorna todos os dados de uma vez (pode ser lento com muitos dados)
 */
const pull = async (req, res, next) => {
  try {
    const empresa = req.user.empresa;
    const tabelaPreco = req.user.tabela;
    const vendedor = req.user.funcionario;

    // 1. Buscar clientes (do vendedor + sem vendedor)
    const [clientes] = await db.query(`
      SELECT codigo, razao, fantasia, cnpj_cpf, ie_rg,
             fone_01 AS telefone, cel_01 AS celular, email_01 AS email,
             dsc_cidade AS cidade_descricao, uf AS estado, cep,
             logradouro, numero, bairro, complemento, observacao,
             restricao, limite_credito AS limite, tabelapreco_id, condicao,
             seguimento, regime, link
      FROM afv_tbcadastro 
      WHERE empresa = ? AND funcionario IN (0, ?)
      ORDER BY razao
    `, [empresa, vendedor]);

    // 2. Buscar produtos com preço
    const [produtos] = await db.query(`
      SELECT pr.produto AS codigo, pr.descricao, pr.especificacao AS codigoean,
             pr.unidade, pr.pd_saldo AS estoque, pr.grupo, pr.produtoref,
             COALESCE(pc.preco, 0) AS preco
      FROM afv_tbproduto pr
      LEFT JOIN afv_tbpreco pc ON pc.produto = pr.produto 
        AND pc.empresa = pr.empresa AND pc.tabela = ?
      WHERE pr.empresa = ?
      ORDER BY pr.descricao
    `, [tabelaPreco, empresa]);

    // 3. Preços (só da tabela do vendedor para reduzir)
    const [precos] = await db.query(`
      SELECT p.produto AS produto_codigo, p.tabela AS tabelapreco_id, 
             t.descricao AS dsc_tabelapreco,
             t.limite_desconto, t.limite_acrescimo,
             p.preco, p.preco2 AS preco_minimo, p.promocao
      FROM afv_tbpreco p
      LEFT JOIN afv_tbtabela t ON t.tabela = p.tabela AND t.empresa = p.empresa
      WHERE p.empresa = ? AND p.tabela = ?
      ORDER BY p.produto
    `, [empresa, tabelaPreco]);

    // 4. Tabelas de preço
    const [tabelas] = await db.query(
      'SELECT tabela AS id, descricao FROM afv_tbtabela WHERE empresa = ? ORDER BY descricao',
      [empresa]
    );

    // 5. Condições de pagamento
    const [condicoes] = await db.query(
      'SELECT DISTINCT condicao AS id, descricao FROM afv_tbcondicao WHERE empresa = ? ORDER BY descricao',
      [empresa]
    );

    // 6. Formas de pagamento
    let formasPagamento = [];
    try {
      const [formas] = await db.query(
        'SELECT codigo AS id, descricao FROM afv_tbformapgto WHERE empresa = ? ORDER BY descricao',
        [empresa]
      );
      formasPagamento = formas;
    } catch (e) {}

    res.json({
      success: true,
      data: {
        clientes,
        produtos,
        precos,
        tabelas_preco: tabelas,
        condicoes,
        formas_pagamento: formasPagamento,
      },
      counts: {
        clientes: clientes.length,
        produtos: produtos.length,
        precos: precos.length,
        tabelas: tabelas.length,
        condicoes: condicoes.length,
      },
      server_timestamp: Date.now(),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /sync/push
 * Recebe pedidos criados offline e salva no banco
 * Retorna mapeamento de ID local → ID servidor
 */
const push = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { pedidos = [] } = req.body;
    const vendedor = req.user.funcionario;
    const resultados = [];

    await conn.beginTransaction();

    for (const pedido of pedidos) {
      try {
        const { 
          local_id, cliente_id, tabelapreco_id, condicao, formapagamento,
          observacao, solicitante, pedidocliente, data, entrega, itens = [] 
        } = pedido;

        // Buscar próximo NUMPEDIDO
        const [[{ maxped }]] = await conn.query(
          'SELECT IFNULL(MAX(NUMPEDIDO), 0) + 1 AS maxped FROM afv_pedido'
        );

        // Gerar NUMPEDIDOAVF no formato: YYYYMMDD + VENDEDOR(5) + SEQ(5)
        const hoje = new Date();
        const dataStr = hoje.toISOString().slice(0,10).replace(/-/g, '');
        const vendedorStr = String(vendedor).padStart(5, '0');
        const prefixo = dataStr + vendedorStr;
        
        const [[{ maxseq }]] = await conn.query(
          `SELECT IFNULL(MAX(CAST(SUBSTRING(NUMPEDIDOAVF, 14, 5) AS UNSIGNED)), 0) + 1 AS maxseq 
           FROM afv_pedido WHERE NUMPEDIDOAVF LIKE ?`,
          [prefixo + '%']
        );
        const numPedidoAVF = prefixo + String(maxseq).padStart(5, '0');

        // Calcular totais
        let bruto = 0, desconto = 0, acrescimo = 0, liquido = 0;
        itens.forEach(it => {
          const precoTab = it.preco_tab || it.preco;
          bruto    += precoTab * it.quantidade;
          desconto += (it.desconto  || 0) * it.quantidade;
          acrescimo+= (it.acrescimo || 0) * it.quantidade;
          liquido  += it.preco * it.quantidade;
        });

        // Usar datas recebidas ou fallback para hoje (formato YYYY-MM-DD sem conversão de timezone)
        const formatDate = (d) => {
          if (!d) {
            const hoje = new Date();
            const year = hoje.getFullYear();
            const month = String(hoje.getMonth() + 1).padStart(2, '0');
            const day = String(hoje.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
          // Se for string, extrair apenas YYYY-MM-DD
          if (typeof d === 'string') {
            return d.slice(0, 10);
          }
          // Se for timestamp ou Date
          const dt = new Date(d);
          const year = dt.getFullYear();
          const month = String(dt.getMonth() + 1).padStart(2, '0');
          const day = String(dt.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const dataPedido = formatDate(data);
        const dataEntrega = formatDate(entrega);

        // Inserir pedido
        await conn.query(
          `INSERT INTO afv_pedido
           (NUMPEDIDO,NUMPEDIDOAVF,DATAPEDIDO,DATAENTREGA,DATA_ENVIO,CODIGO_CLIENTE,
            CODIGO_TIPOPEDIDO,CODIGO_TABPRECO,CONDICAO_PGTO,FORMA_PGTO,OBSERVACAO,CODIGO_VENDEDOR,
            DESCONTO,ACRESCIMO,VALOR_BRUTO,VALOR_LIQUIDO,STATUS,SOLICITANTE,PEDIDOCLIENTE)
           VALUES (?,?,?,?,NOW(),?,?,?,?,?,?,?,?,?,?,?,'A',?,?)`,
          [maxped, numPedidoAVF, dataPedido, dataEntrega, cliente_id, 1, tabelapreco_id||1, condicao||1,
           formapagamento||null, observacao||'', vendedor, desconto, acrescimo, bruto, liquido,
           solicitante||'', pedidocliente||'']
        );

        // Inserir itens
        for (let i = 0; i < itens.length; i++) {
          const it = itens[i];
          await conn.query(
            `INSERT INTO afv_itenspedido
             (NUMPEDIDO,NUMITEM,CODIGO_PRODUTO,CODIGO_PRODUTO_REF,CODIGO_EAN,CODIGO_UNIDFAT,
              CODIGO_TABPRECO,QTDE_VENDA,VALOR_UNITARIO,VALOR_BRUTO,VALOR_VENDA,
              DESCONTO,ACRESCIMO,DESCONTO_RATEADO,ACRESCIMO_RATEADO,COMPLEMENTO,STATUS)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'A')`,
            [maxped, i+1, it.produto, parseInt(it.produtoref)||0, it.codigoean||'', it.unidade||'UN',
             it.tabela || String(tabelapreco_id||1), it.quantidade, it.preco_tab||it.preco,
             (it.preco_tab||it.preco) * it.quantidade, it.preco,
             it.desconto||0, it.acrescimo||0, it.desconto_rateado||0, it.acrescimo_rateado||0, it.observacao||'']
          );
        }

        resultados.push({
          local_id,
          server_id: maxped,
          pedido_avf: numPedidoAVF,
          success: true,
          liquido,
          itens_count: itens.length,
        });

      } catch (itemError) {
        console.error('Erro ao salvar pedido:', itemError);
        resultados.push({
          local_id: pedido.local_id,
          success: false,
          error: itemError.message,
        });
      }
    }

    await conn.commit();

    res.json({
      success: true,
      resultados,
      total_enviados: resultados.filter(r => r.success).length,
      total_erros: resultados.filter(r => !r.success).length,
      synced_at: Date.now(),
    });

  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { 
    conn.release(); 
  }
};

/**
 * GET /sync/status
 * Verifica status de pedidos enviados
 */
const status = async (req, res, next) => {
  try {
    const { pedido_ids } = req.query;
    const vendedor = req.user.funcionario;

    if (!pedido_ids) {
      return res.json({ success: true, pedidos: [] });
    }

    const ids = pedido_ids.split(',').map(Number).filter(id => !isNaN(id));
    
    if (ids.length === 0) {
      return res.json({ success: true, pedidos: [] });
    }

    const [pedidos] = await db.query(`
      SELECT NUMPEDIDO AS id, NUMPEDIDOAVF AS pedido_avf, STATUS AS status, 
             DATAPEDIDO AS data_pedido, VALOR_LIQUIDO AS valor
      FROM afv_pedido 
      WHERE CODIGO_VENDEDOR = ? AND NUMPEDIDO IN (?)
    `, [vendedor, ids]);

    res.json({
      success: true,
      pedidos,
    });

  } catch (err) { 
    next(err); 
  }
};

/**
 * GET /sync/check
 * Verifica se há alterações desde a última sincronização
 * Retorna checksums para comparação rápida
 */
const check = async (req, res, next) => {
  try {
    const empresa = req.user.empresa;
    const vendedor = req.user.funcionario;
    const tabelaPreco = req.user.tabela;

    // Contagens
    const [[clientesCount]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbcadastro WHERE empresa = ? AND funcionario IN (0, ?)',
      [empresa, vendedor]
    );

    const [[produtosCount]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbproduto WHERE empresa = ?',
      [empresa]
    );

    const [[precosCount]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbpreco WHERE empresa = ? AND tabela = ?',
      [empresa, tabelaPreco]
    );

    // Checksums simples (soma dos IDs) - detecta inclusões/exclusões
    const [[clientesChecksum]] = await db.query(
      'SELECT IFNULL(SUM(codigo), 0) as checksum FROM afv_tbcadastro WHERE empresa = ? AND funcionario IN (0, ?)',
      [empresa, vendedor]
    );

    const [[produtosChecksum]] = await db.query(
      'SELECT IFNULL(SUM(produto), 0) as checksum FROM afv_tbproduto WHERE empresa = ?',
      [empresa]
    );

    // Checksum de preços (detecta alterações de preço)
    const [[precosChecksum]] = await db.query(
      'SELECT IFNULL(SUM(preco * 100), 0) as checksum FROM afv_tbpreco WHERE empresa = ? AND tabela = ?',
      [empresa, tabelaPreco]
    );

    res.json({
      success: true,
      checksums: {
        clientes: {
          count: clientesCount.total,
          checksum: String(clientesChecksum.checksum),
        },
        produtos: {
          count: produtosCount.total,
          checksum: String(produtosChecksum.checksum),
        },
        precos: {
          count: precosCount.total,
          checksum: String(precosChecksum.checksum),
        },
      },
      server_timestamp: Date.now(),
    });

  } catch (err) {
    next(err);
  }
};

/**
 * GET /sync/info
 * Retorna informações sobre última sincronização e estatísticas
 */
const info = async (req, res, next) => {
  try {
    const empresa = req.user.empresa;
    const vendedor = req.user.funcionario;

    const [[clientesCount]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbcadastro WHERE empresa = ?', [empresa]
    );
    
    const [[produtosCount]] = await db.query(
      'SELECT COUNT(*) as total FROM afv_tbproduto WHERE empresa = ?', [empresa]
    );

    const [[pedidosPendentes]] = await db.query(
      `SELECT COUNT(*) as total FROM afv_pedido 
       WHERE CODIGO_VENDEDOR = ? AND STATUS = 'A'`, [vendedor]
    );

    res.json({
      success: true,
      stats: {
        clientes: clientesCount.total,
        produtos: produtosCount.total,
        pedidos_pendentes: pedidosPendentes.total,
      },
      server_timestamp: Date.now(),
    });

  } catch (err) { 
    next(err); 
  }
};

/**
 * GET /sync/pull/pedidos?page=1&limit=100
 * Retorna pedidos do vendedor logado (paginados)
 */
const pullPedidos = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, desde } = req.query;
    const vendedor = req.user.funcionario;
    const offset = (page - 1) * limit;

    // Filtro opcional por data (para sync incremental)
    let whereData = '';
    const params = [vendedor];
    if (desde) {
      whereData = ' AND p.DATAPEDIDO >= ?';
      params.push(desde);
    }

    // Total de pedidos do vendedor
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM afv_pedido p 
       WHERE p.CODIGO_VENDEDOR = ?${whereData}`,
      params
    );

    // Pedidos paginados
    const queryParams = [...params, Number(limit), Number(offset)];
    const [pedidos] = await db.query(`
      SELECT p.NUMPEDIDO AS pedido, p.NUMPEDIDOAVF AS pedidoavf,
             p.DATAPEDIDO AS data, p.DATAENTREGA AS entrega,
             p.DATA_ENVIO AS envio,
             p.CODIGO_CLIENTE AS cliente_id, c.razao, c.fantasia,
             p.CODIGO_VENDEDOR AS vendedor_id,
             p.CODIGO_TABPRECO AS tabelapreco_id, p.CONDICAO_PGTO AS condicao,
             p.FORMA_PGTO AS formapagamento,
             p.STATUS AS status, p.CODIGO_TIPOPEDIDO AS tipo,
             p.VALOR_BRUTO AS bruto, p.DESCONTO AS desconto,
             p.ACRESCIMO AS acrescimo, p.VALOR_LIQUIDO AS liquido,
             p.OBSERVACAO AS observacao, p.SOLICITANTE AS solicitante,
             p.PEDIDOCLIENTE AS pedidocliente
      FROM afv_pedido p
      LEFT JOIN afv_tbcadastro c ON c.codigo = p.CODIGO_CLIENTE
      WHERE p.CODIGO_VENDEDOR = ?${whereData}
      ORDER BY p.NUMPEDIDO DESC
      LIMIT ? OFFSET ?
    `, queryParams);

    // Buscar todos os itens de uma vez (otimização: evita N+1 queries)
    let pedidosComItens = pedidos;
    if (pedidos.length > 0) {
      const pedidoIds = pedidos.map(p => p.pedido);
      const [todosItens] = await db.query(`
        SELECT i.NUMPEDIDO AS pedido, i.NUMITEM AS item, i.CODIGO_PRODUTO AS produto,
               i.CODIGO_PRODUTO_REF AS produtoref, i.CODIGO_EAN AS codigoean, pr.descricao,
               i.CODIGO_UNIDFAT AS unidade, i.QTDE_VENDA AS quantidade,
               i.VALOR_UNITARIO AS preco_tab, i.VALOR_VENDA AS preco,
               i.DESCONTO AS desconto, i.ACRESCIMO AS acrescimo,
               i.COMPLEMENTO AS observacao
        FROM afv_itenspedido i
        LEFT JOIN afv_tbproduto pr ON pr.produto = i.CODIGO_PRODUTO
        WHERE i.NUMPEDIDO IN (?)
        ORDER BY i.NUMPEDIDO, i.NUMITEM
      `, [pedidoIds]);
      
      // Agrupar itens por pedido em memória
      const itensPorPedido = {};
      for (const item of todosItens) {
        if (!itensPorPedido[item.pedido]) {
          itensPorPedido[item.pedido] = [];
        }
        // Remover campo pedido do item (já está no header)
        const { pedido: _, ...itemSemPedido } = item;
        itensPorPedido[item.pedido].push(itemSemPedido);
      }
      
      pedidosComItens = pedidos.map(p => ({
        ...p,
        itens: itensPorPedido[p.pedido] || []
      }));
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: pedidosComItens,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  pull, push, status, info, check,
  pullMetadata, pullClientes, pullProdutos, pullPrecos, pullCounts, pullPedidos 
};
