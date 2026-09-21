import express from "express";
import cors from "cors";
import { env } from "./config/environment.js";
import { pool, testDatabaseConnection } from "./config/database.js";
import healthRoutes from "./routes/healthRoutes.js";
import terminalRoutes from "./routes/terminalRoutes.js";
import tillBalanceRoutes from "./routes/tillBalanceRoutes.js";
import generalShopStatusRoutes from "./routes/generalShopStatusRoutes.js";
import cashBookRoutes from "./routes/cashBookRoutes.js";
import branchRoutes from "./routes/branchRoutes.js";
import cashBookExpenseRoutes from "./routes/cashBookExpenseRoutes.js";
import masterDataRoutes from "./routes/masterDataRoutes.js";
import branchFloatRoutes from "./routes/branchFloatRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { requireAuth } from "./middleware/auth.js";
import { ensureInitialManager } from "./controllers/authController.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", requireAuth);
app.use("/api", terminalRoutes);
app.use("/api", tillBalanceRoutes);
app.use("/api", generalShopStatusRoutes);
app.use("/api", cashBookRoutes);
app.use("/api", branchRoutes);
app.use("/api", cashBookExpenseRoutes);
app.use("/api", masterDataRoutes);
app.use("/api", branchFloatRoutes);
app.use((err,_req,res,_next)=>{ console.error(err); res.status(err.statusCode||500).json({error:err.statusCode?err.message:"Internal server error"}); });

async function startServer(){
  try {
    const db=await testDatabaseConnection();
    await ensureInitialManager();
    console.log(`PostgreSQL connected successfully: ${db.database} as ${db.user}`);
    const server=app.listen(env.port,()=>console.log(`AirtelComm-Bal-System API running on http://localhost:${env.port}`));
    const shutdown=async()=>server.close(async()=>{await pool.end();process.exit(0)});
    process.on("SIGINT",shutdown); process.on("SIGTERM",shutdown);
  } catch(error){ console.error("PostgreSQL connection failed."); console.error(error.message); await pool.end(); process.exit(1); }
}
startServer();
