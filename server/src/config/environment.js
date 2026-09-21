import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  database: {
    host: process.env.DATABASE_HOST || "localhost",
    port: Number(process.env.DATABASE_PORT || 5432),
    name: process.env.DATABASE_NAME || "airtelcomm_bal_system",
    user: process.env.DATABASE_USER || "postgres",
    password: process.env.DATABASE_PASSWORD || ""
  }
};
