import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "./models/Role.js";
import User from "./models/User.js";

dotenv.config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to DB");

    // 1. Create roles if they don't exist
    const adminRole = await Role.findOne({ name: "admin" });
    if (!adminRole) {
      await Role.create({ name: "admin", description: "Administrator" });
      console.log("✅ Admin role created");
    }

    // 2. Check existing roles
    const roles = await Role.find({});
    console.log("📋 Available roles:", roles.map(r => r.name));

    // 3. Test user creation
    const testUser = {
      username: "testadmin",
      email: "testadmin@fleet.com",
      password: "hashedpassword123",
      role: adminRole._id  // Use the ObjectId directly
    };

    const user = await User.create(testUser);
    console.log("✅ User created:", user);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

test();