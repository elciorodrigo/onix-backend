const db = require('../config/database');

const listar = async (req, res, next) => {
  try {
    const { busca, limit = 30, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    const empresa = req.user.empresa;

    let where = 'WHERE empresa = ?';
    const params = [empresa];
    if (busca) {
      where += ' AND (razao LIKE ? OR fantasia LIKE ? OR cnpj_cpf LIKE ?)';
      const b = '%' + busca + '%';
      params.push(b, b, b);
    }

    const [rows] = await db.query(
      `SELECT codigo, razao, fantasia, cnpj_cpf, ie_rg,
              fone_01 AS telefone, cel_01 AS celular, email_01 AS email,
              dsc_cidade AS cidade_descricao, uf AS estado, cep,
              logradouro, numero, bairro, observacao,
              restricao, limite_credito AS limite, tabelapreco_id, condicao
       FROM afv_tbcadastro ${where} ORDER BY razao LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    res.json({ data: rows, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
};

const buscarPorCodigo = async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const empresa = req.user.empresa;
    const [rows] = await db.query(
      `SELECT codigo, razao, fantasia, cnpj_cpf, ie_rg,
              fone_01 AS telefone, cel_01 AS celular, email_01 AS email,
              dsc_cidade AS cidade_descricao, uf AS estado, cep,
              logradouro, numero, bairro, observacao,
              restricao, limite_credito AS limite, tabelapreco_id, condicao
       FROM afv_tbcadastro WHERE empresa = ? AND codigo = ? LIMIT 1`,
      [empresa, codigo]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'Cliente nao encontrado.' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
};

const financeiro = async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const empresa = req.user.empresa;
    const [rows] = await db.query(
      `SELECT documento, data_emissao, data_vencimento,
              vlr_titulo, vlr_pago, vlr_devido, dias_atraso
       FROM afv_tituloreceber
       WHERE empresa = ? AND cliente_id = ?
       ORDER BY data_vencimento`,
      [empresa, codigo]
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
};

const criar = async (req, res, next) => {
  res.status(501).json({ error: 'Criacao de clientes nao implementada.' });
};

module.exports = { listar, buscarPorCodigo, financeiro, criar };
