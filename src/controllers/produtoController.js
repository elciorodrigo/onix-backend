const db = require('../config/database');

const listar = async (req, res, next) => {
  try {
    const { limit = 30, page = 1, busca, tabela } = req.query;
    const offset = (page - 1) * limit;
    const empresa = req.user.empresa;
    const tabelaPreco = tabela || req.user.tabela;

    let where = 'WHERE pr.empresa = ?';
    const params = [empresa];
    if (busca) {
      where += ' AND (pr.descricao LIKE ? OR pr.produto LIKE ?)';
      params.push('%'+busca+'%', '%'+busca+'%');
    }
    const [rows] = await db.query(
      `SELECT pr.produto AS codigo, pr.descricao, pr.especificacao, pr.unidade,
              pr.pd_saldo AS estoque, pr.grupo,
              COALESCE(pc.preco, 0) AS preco
       FROM afv_tbproduto pr
       LEFT JOIN afv_tbpreco pc ON pc.produto = pr.produto AND pc.empresa = pr.empresa AND pc.tabela = ?
       ${where} ORDER BY pr.descricao LIMIT ? OFFSET ?`,
      [tabelaPreco, ...params, Number(limit), Number(offset)]
    );
    res.json({ data: rows, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

const buscarPorCodigo = async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const empresa = req.user.empresa;
    const [rows] = await db.query(
      `SELECT produto AS codigo, descricao, especificacao, unidade,
              pd_saldo AS estoque, grupo
       FROM afv_tbproduto WHERE empresa = ? AND produto = ? LIMIT 1`,
      [empresa, codigo]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Produto nao encontrado.' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
};

const precos = async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const { tabela } = req.query;
    const empresa = req.user.empresa;

    let where = 'p.empresa = ? AND p.produto = ?';
    const params = [empresa, codigo];
    if (tabela) { where += ' AND p.tabela = ?'; params.push(tabela); }

    const [rows] = await db.query(
      `SELECT p.tabela AS tabelapreco_id, t.descricao AS dsc_tabelapreco,
              t.limite_desconto, t.limite_acrescimo,
              p.preco, p.promocao, p.preco2 AS preco_minimo
       FROM afv_tbpreco p
       LEFT JOIN afv_tbtabela t ON t.tabela = p.tabela AND t.empresa = p.empresa
       WHERE ${where} ORDER BY t.descricao`,
      params
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
};

const estoque = async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const empresa = req.user.empresa;
    const [rows] = await db.query(
      'SELECT pd_saldo AS estoque FROM afv_tbproduto WHERE empresa = ? AND produto = ?',
      [empresa, codigo]
    );
    res.json({ data: { estoque: rows[0]?.estoque ?? 0 } });
  } catch (err) { next(err); }
};

const tabelasPreco = async (req, res, next) => {
  try {
    const empresa = req.user.empresa;
    const [rows] = await db.query(
      'SELECT tabela AS id, descricao FROM afv_tbtabela WHERE empresa = ? ORDER BY descricao',
      [empresa]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
};

const condicoes = async (req, res, next) => {
  try {
    const empresa = req.user.empresa;
    const [rows] = await db.query(
      'SELECT DISTINCT condicao AS id, descricao FROM afv_tbcondicao WHERE empresa = ? ORDER BY descricao',
      [empresa]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
};

module.exports = { listar, buscarPorCodigo, precos, estoque, tabelasPreco, condicoes };
