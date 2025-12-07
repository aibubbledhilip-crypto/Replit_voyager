import { pool } from "../db";

async function testConnection() {
  console.log("Testing database connection...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
  
  try {
    const result = await pool.query("SELECT 1 as test");
    console.log("Connection successful!", result.rows);
    process.exit(0);
  } catch (error: any) {
    console.error("Connection failed:", error.message);
    process.exit(1);
  }
}

testConnection();
