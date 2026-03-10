const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '-03:00',
  connectTimeout: 10000,
});

pool.getConnection()
  .then(conn => {
    console.log(`✅ Banco conectado: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
    conn.release();
  })
  .catch(err => {
    console.error(`❌ Erro ao conectar no banco: [${err.code}] ${err.message}`);
    console.error(`   Host: ${process.env.DB_HOST}:${process.env.DB_PORT}  DB: ${process.env.DB_NAME}  User: ${process.env.DB_USER}`);
    console.error('   Verifique as variáveis DB_HOST, DB_PORT, DB_USER, DB_PASS no arquivo .env');
  });

module.exports = pool;
