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

    // Set default Explorer configurations (table and column for each data source)
    const explorerConfigs = [
      { table: "explorer_table_sf", column: "explorer_column_sf", tableValue: "vw_sf_all_segment_hierarchy", columnValue: "msisdn", label: "SF" },
      { table: "explorer_table_aria", column: "explorer_column_aria", tableValue: "vw_aria_hierarchy_all_status_reverse", columnValue: "msisdn", label: "Aria" },
      { table: "explorer_table_matrix", column: "explorer_column_matrix", tableValue: "vw_matrixx_plan", columnValue: "msisdn", label: "Matrix" },
      { table: "explorer_table_trufinder", column: "explorer_column_trufinder", tableValue: "vw_true_finder_raw", columnValue: "msisdn", label: "Trufinder" },
      { table: "explorer_table_nokia", column: "explorer_column_nokia", tableValue: "vw_nokia_raw", columnValue: "msisdn", label: "Nokia" },
    ];

    for (const config of explorerConfigs) {
      await storage.upsertSetting({
        key: config.table,
        value: config.tableValue,
      });
      await storage.upsertSetting({
        key: config.column,
        value: config.columnValue,
      });
      console.log(`✓ Set Explorer ${config.label}: table=${config.tableValue}, column=${config.columnValue}`);
    }

    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seed();
