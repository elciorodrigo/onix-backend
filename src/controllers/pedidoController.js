const db = require('../config/database');

const listar = async (req, res, next) => {
  try {
    const { limit = 30, page = 1, status } = req.query;
    const offset = (page - 1) * limit;
    const funcionario = req.user.funcionario;

    let where = 'WHERE p.CODIGO_VENDEDOR = ?';
    const params = [funcionario];
    if (status) { where += ' AND p.STATUS = ?'; params.push(status); }

    const [rows] = await db.query(
      `SELECT p.NUMPEDIDO AS pedido, p.DATAPEDIDO AS data, p.DATAENTREGA AS entrega,
              p.CODIGO_CLIENTE AS cliente_id, c.razao, c.fantasia,
              p.STATUS AS status, p.VALOR_BRUTO AS bruto,
              p.DESCONTO AS desconto, p.ACRESCIMO AS acrescimo,
              p.VALOR_LIQUIDO AS liquido, p.OBSERVACAO AS observacao
       FROM afv_pedido p
       LEFT JOIN afv_tbcadastro c ON c.codigo = p.CODIGO_CLIENTE
       ${where} ORDER BY p.NUMPEDIDO DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    res.json({ data: rows, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

const buscarPorNumero = async (req, res, next) => {
  try {
    const { pedido } = req.params;
    const [pedidos] = await db.query(
      `SELECT p.NUMPEDIDO AS pedido, p.DATAPEDIDO AS data, p.DATAENTREGA AS entrega,
              p.CODIGO_CLIENTE AS cliente_id, c.razao, c.fantasia,
              p.STATUS AS status, p.VALOR_BRUTO AS bruto, p.DESCONTO AS desconto,
              p.ACRESCIMO AS acrescimo, p.VALOR_LIQUIDO AS liquido,
              p.OBSERVACAO AS observacao, p.CONDICAO_PGTO AS condicao,
              p.CODIGO_TABPRECO AS tabelapreco_id,
              p.SOLICITANTE AS solicitante, p.PEDIDOCLIENTE AS pedidocliente
       FROM afv_pedido p
       LEFT JOIN afv_tbcadastro c ON c.codigo = p.CODIGO_CLIENTE
       WHERE p.NUMPEDIDO = ?`,
      [pedido]
    );
    if (pedidos.length === 0)
      return res.status(404).json({ error: 'Pedido nao encontrado.' });

    const [itens] = await db.query(
      `SELECT i.CODIGO_PRODUTO AS produto, i.CODIGO_PRODUTO_REF AS produtoref,
              i.CODIGO_EAN AS codigoean, pr.descricao, i.CODIGO_UNIDFAT AS unidade,
              i.QTDE_VENDA AS quantidade, i.VALOR_UNITARIO AS preco_tab,
              i.VALOR_VENDA AS preco, i.DESCONTO AS desconto,
              i.ACRESCIMO AS acrescimo, i.COMPLEMENTO AS observacao
       FROM afv_itenspedido i
       LEFT JOIN afv_tbproduto pr ON pr.produto = i.CODIGO_PRODUTO
       WHERE i.NUMPEDIDO = ? ORDER BY i.NUMITEM`,
      [pedido]
    );
    res.json({ data: { ...pedidos[0], itens } });
  } catch (err) { next(err); }
};

const criar = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { cliente_id, tabelapreco_id, condicao, formapagamento,
            observacao, solicitante, pedidocliente, data, entrega, itens = [] } = req.body;
    const vendedor = req.user.funcionario;

    // Buscar próximo NUMPEDIDO
    const [[{ maxped }]] = await conn.query(
      'SELECT IFNULL(MAX(NUMPEDIDO), 0) + 1 AS maxped FROM afv_pedido'
    );

    // Gerar NUMPEDIDOAVF no formato: YYYYMMDD + VENDEDOR(5) + SEQ(5)
    const hoje = new Date();
    const dataStr = hoje.toISOString().slice(0,10).replace(/-/g, ''); // YYYYMMDD
    const vendedorStr = String(vendedor).padStart(5, '0');
    const prefixo = dataStr + vendedorStr; // ex: 2026030900001
    
    const [[{ maxseq }]] = await conn.query(
      `SELECT IFNULL(MAX(CAST(SUBSTRING(NUMPEDIDOAVF, 14, 5) AS UNSIGNED)), 0) + 1 AS maxseq 
       FROM afv_pedido WHERE NUMPEDIDOAVF LIKE ?`,
      [prefixo + '%']
    );
    const numPedidoAVF = prefixo + String(maxseq).padStart(5, '0');

    let bruto = 0, desconto = 0, acrescimo = 0, liquido = 0;
    itens.forEach(it => {
      bruto    += (it.preco_tab || it.preco) * it.quantidade;
      desconto += (it.desconto  || 0)        * it.quantidade;
      acrescimo+= (it.acrescimo || 0)        * it.quantidade;
      liquido  +=  it.preco                  * it.quantidade;
    });

    // Usar datas recebidas ou fallback para agora (zerar hora para 00:00:00)
    const dataPedido = data ? new Date(data) : new Date();
    dataPedido.setHours(0, 0, 0, 0);
    const dataEntrega = entrega ? new Date(entrega) : new Date();
    dataEntrega.setHours(0, 0, 0, 0);

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
    await conn.commit();
    res.status(201).json({ data: { pedido: maxped, liquido, bruto, itens: itens.length } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
};

const atualizarStatus = async (req, res, next) => {
  try {
    const { pedido } = req.params;
    const { status } = req.body;
    await db.query('UPDATE afv_pedido SET STATUS = ? WHERE NUMPEDIDO = ?', [status, pedido]);
    res.json({ data: { pedido: Number(pedido), status } });
  } catch (err) { next(err); }
};

// Atualizar pedido completo (itens, preços, descontos)
const atualizar = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { pedido } = req.params;
    const { observacao, condicao, formapagamento, tabelapreco_id, desconto_geral = 0, 
            acrescimo_geral = 0, itens = [] } = req.body;

    // Verificar se pedido existe e está em status editável (A = Aguardando)
    const [[pedidoAtual]] = await conn.query(
      'SELECT STATUS, CODIGO_VENDEDOR FROM afv_pedido WHERE NUMPEDIDO = ?', [pedido]
    );
    if (!pedidoAtual) {
      await conn.rollback();
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    if (pedidoAtual.STATUS !== 'A') {
      await conn.rollback();
      return res.status(400).json({ error: 'Pedido já foi processado e não pode ser editado.' });
    }

    // Calcular totais
    let bruto = 0, descontoItens = 0, acrescimoItens = 0, liquido = 0;
    itens.forEach(it => {
      const totalBrutoItem = (it.preco_tab || it.preco) * it.quantidade;
      const descontoItem = (it.desconto || 0) * it.quantidade;
      const acrescimoItem = (it.acrescimo || 0) * it.quantidade;
      const totalLiquidoItem = it.preco * it.quantidade;
      
      bruto += totalBrutoItem;
      descontoItens += descontoItem;
      acrescimoItens += acrescimoItem;
      liquido += totalLiquidoItem;
    });

    // Aplicar desconto/acréscimo geral (no fechamento)
    const descontoTotal = descontoItens + Number(desconto_geral);
    const acrescimoTotal = acrescimoItens + Number(acrescimo_geral);
    liquido = liquido - Number(desconto_geral) + Number(acrescimo_geral);

    // Atualizar cabeçalho
    await conn.query(
      `UPDATE afv_pedido SET 
        OBSERVACAO = ?, CONDICAO_PGTO = ?, FORMA_PGTO = ?, CODIGO_TABPRECO = ?,
        VALOR_BRUTO = ?, DESCONTO = ?, ACRESCIMO = ?, VALOR_LIQUIDO = ?
       WHERE NUMPEDIDO = ?`,
      [observacao || '', condicao || 1, formapagamento || null, tabelapreco_id || 1,
       bruto, descontoTotal, acrescimoTotal, liquido, pedido]
    );

    // Deletar itens antigos
    await conn.query('DELETE FROM afv_itenspedido WHERE NUMPEDIDO = ?', [pedido]);

    // Inserir novos itens
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      await conn.query(
        `INSERT INTO afv_itenspedido
         (NUMPEDIDO,NUMITEM,CODIGO_PRODUTO,CODIGO_PRODUTO_REF,CODIGO_EAN,CODIGO_UNIDFAT,
          CODIGO_TABPRECO,QTDE_VENDA,VALOR_UNITARIO,VALOR_BRUTO,VALOR_VENDA,
          DESCONTO,ACRESCIMO,DESCONTO_RATEADO,ACRESCIMO_RATEADO,COMPLEMENTO,STATUS)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'A')`,
        [pedido, i+1, it.produto, parseInt(it.produtoref)||0, it.codigoean||'', it.unidade||'UN',
         it.tabela || String(tabelapreco_id||1), it.quantidade, it.preco_tab||it.preco,
         (it.preco_tab||it.preco) * it.quantidade, it.preco,
         it.desconto||0, it.acrescimo||0, it.desconto_rateado||0, 
         it.acrescimo_rateado||0, it.observacao||'']
      );
    }

    await conn.commit();
    res.json({ 
      data: { 
        pedido: Number(pedido), 
        bruto, 
        desconto: descontoTotal, 
        acrescimo: acrescimoTotal,
        liquido, 
        itens: itens.length 
      } 
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
};

// Relatório de pedidos por período
const relatorio = async (req, res, next) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const funcionario = req.user.funcionario;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({ error: 'Informe data_inicio e data_fim' });
    }

    // Resumo geral
    const [resumo] = await db.query(
      `SELECT 
        COUNT(*) AS total_pedidos,
        COALESCE(SUM(VALOR_BRUTO), 0) AS total_bruto,
        COALESCE(SUM(DESCONTO), 0) AS total_desconto,
        COALESCE(SUM(ACRESCIMO), 0) AS total_acrescimo,
        COALESCE(SUM(VALOR_LIQUIDO), 0) AS total_liquido,
        COUNT(CASE WHEN STATUS = 'A' THEN 1 END) AS aguardando,
        COUNT(CASE WHEN STATUS = 'P' THEN 1 END) AS processados,
        COUNT(CASE WHEN STATUS = 'C' THEN 1 END) AS cancelados
       FROM afv_pedido
       WHERE CODIGO_VENDEDOR = ?
         AND DATE(DATAPEDIDO) BETWEEN ? AND ?`,
      [funcionario, data_inicio, data_fim]
    );

    // Pedidos por dia
    const [porDia] = await db.query(
      `SELECT 
        DATE(DATAPEDIDO) AS data,
        COUNT(*) AS quantidade,
        COALESCE(SUM(VALOR_LIQUIDO), 0) AS valor
       FROM afv_pedido
       WHERE CODIGO_VENDEDOR = ?
         AND DATE(DATAPEDIDO) BETWEEN ? AND ?
       GROUP BY DATE(DATAPEDIDO)
       ORDER BY data`,
      [funcionario, data_inicio, data_fim]
    );

    // Top 10 clientes
    const [topClientes] = await db.query(
      `SELECT 
        c.fantasia, c.razao,
        COUNT(*) AS pedidos,
        COALESCE(SUM(p.VALOR_LIQUIDO), 0) AS valor
       FROM afv_pedido p
       LEFT JOIN afv_tbcadastro c ON c.codigo = p.CODIGO_CLIENTE
       WHERE p.CODIGO_VENDEDOR = ?
         AND DATE(p.DATAPEDIDO) BETWEEN ? AND ?
       GROUP BY p.CODIGO_CLIENTE
       ORDER BY valor DESC
       LIMIT 10`,
      [funcionario, data_inicio, data_fim]
    );

    // Top 10 produtos
    const [topProdutos] = await db.query(
      `SELECT 
        pr.descricao,
        SUM(i.QTDE_VENDA) AS quantidade,
        COALESCE(SUM((i.QTDE_VENDA * i.VALOR_VENDA) - IFNULL(i.DESCONTO, 0) + IFNULL(i.ACRESCIMO, 0)), 0) AS valor
       FROM afv_itenspedido i
       INNER JOIN afv_pedido p ON p.NUMPEDIDO = i.NUMPEDIDO
       LEFT JOIN afv_tbproduto pr ON pr.produto = i.CODIGO_PRODUTO
       WHERE p.CODIGO_VENDEDOR = ?
         AND DATE(p.DATAPEDIDO) BETWEEN ? AND ?
       GROUP BY i.CODIGO_PRODUTO
       ORDER BY valor DESC
       LIMIT 10`,
      [funcionario, data_inicio, data_fim]
    );

    res.json({
      data: {
        periodo: { inicio: data_inicio, fim: data_fim },
        resumo: resumo[0],
        por_dia: porDia,
        top_clientes: topClientes,
        top_produtos: topProdutos
      }
    });
  } catch (err) { next(err); }
};

module.exports = { listar, buscarPorNumero, criar, atualizar, atualizarStatus, relatorio };
