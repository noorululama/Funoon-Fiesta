/**
 * CLI utility to create or reset the Admin Account.
 * Usage:
 *   node scripts/create-admin.js <username> <password>
 * Example:
 *   node scripts/create-admin.js admin admin123
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

function getMongoUri() {
  const envPath = path.resolve(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("MONGODB_URI=")) {
        return trimmed.substring("MONGODB_URI=".length).trim();
      }
    }
  }
  return process.env.MONGODB_URI || "mongodb://localhost:27017/festival_ai";
}

async function main() {
  const args = process.argv.slice(2);
  const username = args[0] || "admin";
  const password = args[1] || "admin123";

  if (password.length < 6) {
    console.error("❌ Password must be at least 6 characters long.");
    process.exit(1);
  }

  const mongoUri = getMongoUri();
  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^@]+)@/, ":****@")}`);

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const hashedPassword = await bcrypt.hash(password, 10);

    const AdminSettingsSchema = new mongoose.Schema(
      {
        username: { type: String, required: true, default: "admin" },
        password: { type: String, required: true, default: "admin123" },
      },
      { timestamps: true }
    );

    const AdminSettings =
      mongoose.models.AdminSettings ||
      mongoose.model("AdminSettings", AdminSettingsSchema);

    const updated = await AdminSettings.findOneAndUpdate(
      {},
      { username, password: hashedPassword },
      { upsert: true, new: true }
    );

    console.log("\n==============================================");
    console.log(" Admin Account Configured Successfully!");
    console.log("==============================================");
    console.log(`Username: ${updated.username}`);
    console.log(`Password: ${password}`);
    console.log("Login URL: http://localhost:3000/admin/login");
    console.log("==============================================\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error setting up admin account:", err);
    process.exit(1);
  }
}

main();
