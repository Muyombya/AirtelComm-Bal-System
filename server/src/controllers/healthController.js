import { testDatabaseConnection } from "../config/database.js";

export async function healthCheck(_req, res) {
  let database = { connected: false, reason: "Not configured" };

  try {
    database = await testDatabaseConnection();
  } catch (error) {
    database = { connected: false, reason: error.message };
  }

  res.json({
    application: "AirtelComm-Bal-System",
    status: "ok",
    database
  });
}
