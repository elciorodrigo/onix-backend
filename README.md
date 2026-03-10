# OnixSistemas API

Node.js REST API com JWT para o aplicativo de força de vendas.

## Requisitos

- Node.js 18+
- Acesso ao MySQL `afv_server`

## Instalação

```bash
cd api
npm install
cp .env.example .env
# edite .env com as credenciais do banco
npm start
```

## Variáveis de ambiente (`.env`)

| Variável     | Descrição                        |
|-------------|----------------------------------|
| DB_HOST     | IP do servidor MySQL             |
| DB_PORT     | Porta MySQL (padrão 3306)        |
| DB_NAME     | Nome do banco (`afv_server`)     |
| DB_USER     | Usuário MySQL                    |
| DB_PASS     | Senha MySQL                      |
| JWT_SECRET  | Segredo para assinar tokens JWT  |
| PORT        | Porta do servidor Express        |

## Endpoints

### Auth
| Método | Rota             | Descrição                      |
|--------|-----------------|-------------------------------|
| POST   | /api/v1/auth/login | Login — retorna JWT token   |
| GET    | /api/v1/auth/me    | Dados do usuário logado      |

### Clientes
| Método | Rota                                  | Ação                        |
|--------|--------------------------------------|-----------------------------|
| GET    | /api/v1/clientes                      | Listar (paginado + busca)   |
| GET    | /api/v1/clientes/:codigo              | Detalhe                     |
| GET    | /api/v1/clientes/:codigo/financeiro   | Títulos em aberto           |
| POST   | /api/v1/clientes                      | Criar novo cliente          |

### Pedidos
| Método | Rota                                  | Ação                        |
|--------|--------------------------------------|-----------------------------|
| GET    | /api/v1/pedidos                       | Listar (paginado)           |
| GET    | /api/v1/pedidos/:numero               | Detalhe com itens           |
| POST   | /api/v1/pedidos                       | Criar pedido (transaction)  |
| PUT    | /api/v1/pedidos/:numero/status        | Atualizar status            |

### Produtos
| Método | Rota                                  | Ação                        |
|--------|--------------------------------------|-----------------------------|
| GET    | /api/v1/produtos                      | Listar (paginado + busca)   |
| GET    | /api/v1/produtos/:codigo              | Detalhe                     |
| GET    | /api/v1/produtos/:codigo/precos       | Preços por tabela           |
| GET    | /api/v1/produtos/:codigo/estoque      | Estoque atual               |
| GET    | /api/v1/produtos/tabelas              | Tabelas de preço            |
| GET    | /api/v1/produtos/condicoes            | Condições de pagamento      |

## Autenticação

Todas as rotas (exceto `/auth/login`) exigem header:

```
Authorization: Bearer <token>
```

## Tabelas MySQL utilizadas

`Usuario`, `Cliente`, `Financeiro`, `PedidoMestre`, `PedidoDetalhe`,
`Produto`, `Tabela`, `TabelaPreco`, `Condicao`
