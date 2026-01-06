// create_role.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Role from "./models/Role.js";

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const role = await Role.create({ name: "admin", permissions: ["manage_all"] });
    console.log("✅ Created role:", role);
    process.exit(0);
  })
  .catch(err => console.error("❌", err));
