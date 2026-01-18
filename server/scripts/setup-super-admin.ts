import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function setupSuperAdmin() {
  const email = process.argv[2];
  
  if (!email) {
    console.error("Usage: npx tsx server/scripts/setup-super-admin.ts <email>");
    console.error("Example: npx tsx server/scripts/setup-super-admin.ts admin@example.com");
    process.exit(1);
  }

  console.log(`Looking for user with email: ${email}`);

  const user = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (user.length === 0) {
    console.error(`User with email "${email}" not found.`);
    console.error("Please create a user first by signing up, then run this script.");
    process.exit(1);
  }

  const existingUser = user[0];
  
  if (existingUser.isSuperAdmin) {
    console.log(`User "${existingUser.username}" is already a super admin.`);
    process.exit(0);
  }

  const result = await db.update(users)
    .set({ isSuperAdmin: true })
    .where(eq(users.id, existingUser.id))
    .returning();

  if (result.length > 0) {
    console.log(`Successfully granted super admin status to user "${result[0].username}" (${result[0].email})`);
    console.log("They can now access the Platform Administration dashboard at /super-admin");
  } else {
    console.error("Failed to update user.");
    process.exit(1);
  }

  process.exit(0);
}

setupSuperAdmin().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
