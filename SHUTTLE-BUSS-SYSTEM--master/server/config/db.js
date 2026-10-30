const oracledb = require("oracledb");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString:
    process.env.DB_CONNECT_STRING ||
    `${process.env.DB_HOST}:${process.env.DB_PORT || 1521}/${process.env.DB_SERVICE}`,
};

/**
 * รันฟังก์ชันกับ connection แล้วปิดอัตโนมัติ
 */
async function withDb(fn) {
  const conn = await oracledb.getConnection(dbConfig);
  try {
    return await fn(conn);
  } finally {
    await conn.close().catch(() => {});
  }
}

const q = (conn, sql, binds = {}) => conn.execute(sql, binds);
const one = async (conn, sql, binds) => (await q(conn, sql, binds)).rows[0] || null;
const all = async (conn, sql, binds) => (await q(conn, sql, binds)).rows;

module.exports = {
  oracledb,
  dbConfig,
  withDb,
  q,
  one,
  all,
};
