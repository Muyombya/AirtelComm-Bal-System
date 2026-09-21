import pg from "pg";
import { env } from "./environment.js";

const { Pool } = pg;

export const pool = new Pool({
  host: env.database.host,
  port: env.database.port,
  database: env.database.name,
  user: env.database.user,
  password: env.database.password
});

export async function testDatabaseConnection() {
  const result = await pool.query("SELECT current_database() AS database, current_user AS user, NOW() AS now");
  return result.rows[0];
}
