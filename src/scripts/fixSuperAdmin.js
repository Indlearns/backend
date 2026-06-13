import dotenv from "dotenv";
import connectDB from "../config/db.js";
import { seedSuperAdmin } from "./seedAdmins.js";

dotenv.config();

process.env.SUPER_ADMIN_RESET_PASSWORD = "true";

const run = async () => {
  await connectDB();
  await seedSuperAdmin();
  console.log("\n✅ Done! Login at http://localhost:5173/superadmin/login");
  console.log(`   Email: ${process.env.SUPER_ADMIN_EMAIL || "official@indlearns.com"}`);
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
