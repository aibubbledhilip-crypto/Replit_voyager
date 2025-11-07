import { storage } from "../storage";

async function seed() {
  console.log("Starting database seed...");

  try {
    // Check if admin already exists
    const existingAdmin = await storage.getUserByUsername("admin");
    
    if (!existingAdmin) {
      // Create initial admin user
      const admin = await storage.createUser({
        username: "admin",
        password: "admin123",
        role: "admin",
      });
      console.log("✓ Created admin user (username: admin, password: admin123)");
    } else {
      console.log("✓ Admin user already exists");
    }

    // Set default row limit
    await storage.upsertSetting({
      key: "row_limit",
      value: "1000",
    });
    console.log("✓ Set default row limit to 1000");

    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seed();
