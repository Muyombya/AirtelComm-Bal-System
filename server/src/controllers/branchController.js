import { pool } from "../config/database.js";

export async function getBranches(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT id, name, contact, email, location, operating_capital
      FROM branches
      WHERE ($1::bigint IS NULL OR id=$1)
      ORDER BY name ASC, id ASC
    `,[req.user.role==="MANAGER"?null:req.user.branch_id]);
    res.json(result.rows.map(row => ({
      ...row,
      id: Number(row.id),
      operating_capital: Number(row.operating_capital || 0),
    })));
  } catch (e) { next(e); }
}
