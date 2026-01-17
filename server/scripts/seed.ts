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

    // Set default row limit (for exports)
    await storage.upsertSetting({
      key: "row_limit",
      value: "1000",
    });
    console.log("✓ Set default export row limit to 1000");

    // Set default display limit
    await storage.upsertSetting({
      key: "display_limit",
      value: "10000",
    });
    console.log("✓ Set default display limit to 10000");

    // Set default MSISDN lookup table configurations
    const msisdnTables = [
      { key: "msisdn_table_sf", value: "vw_sf_all_segment_hierarchy", label: "SF" },
      { key: "msisdn_table_aria", value: "vw_aria_hierarchy_all_status_reverse", label: "Aria" },
      { key: "msisdn_table_matrix", value: "vw_matrixx_plan", label: "Matrix" },
      { key: "msisdn_table_trufinder", value: "vw_true_finder_raw", label: "Trufinder" },
      { key: "msisdn_table_nokia", value: "vw_nokia_raw", label: "Nokia" },
    ];

    for (const table of msisdnTables) {
      await storage.upsertSetting({
        key: table.key,
        value: table.value,
      });
      console.log(`✓ Set MSISDN ${table.label} table to ${table.value}`);
    }

    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seed();
