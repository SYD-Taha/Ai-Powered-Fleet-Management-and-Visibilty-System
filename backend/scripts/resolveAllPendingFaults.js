import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import readline from "readline";
import Fault from "../models/Fault.js";

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the backend directory (parent of scripts)
dotenv.config({ path: join(__dirname, "..", ".env") });

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask user for confirmation
const askConfirmation = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase().trim() === 'yes' || answer.toLowerCase().trim() === 'y');
    });
  });
};

// Get statistics about faults by status
const getFaultStatistics = async () => {
  const stats = {
    waiting: await Fault.countDocuments({ status: "waiting" }),
    pending_confirmation: await Fault.countDocuments({ status: "pending_confirmation" }),
    assigned: await Fault.countDocuments({ status: "assigned" }),
    resolved: await Fault.countDocuments({ status: "resolved" }),
    total: await Fault.countDocuments()
  };
  
  stats.nonResolved = stats.waiting + stats.pending_confirmation + stats.assigned;
  
  return stats;
};

// Display statistics in a formatted way
const displayStatistics = (stats, label = "Current") => {
  console.log(`\n📊 ${label} Fault Statistics:`);
  console.log("─".repeat(40));
  console.log(`   Waiting:            ${stats.waiting}`);
  console.log(`   Pending Confirmation: ${stats.pending_confirmation}`);
  console.log(`   Assigned:           ${stats.assigned}`);
  console.log(`   Resolved:           ${stats.resolved}`);
  console.log("─".repeat(40));
  console.log(`   Non-Resolved Total: ${stats.nonResolved}`);
  console.log(`   Grand Total:        ${stats.total}`);
};

// Display sample fault IDs that would be affected
const displaySampleFaults = async () => {
  const pendingFaults = await Fault.find({
    status: { $in: ["waiting", "pending_confirmation", "assigned"] }
  })
    .select("_id status fault_type fault_location reported_date")
    .sort({ reported_date: 1 })
    .limit(10);
  
  if (pendingFaults.length > 0) {
    console.log("\n📋 Sample Faults That Will Be Resolved (showing up to 10):");
    console.log("─".repeat(80));
    pendingFaults.forEach((fault, index) => {
      const date = new Date(fault.reported_date).toLocaleString();
      console.log(`   ${index + 1}. ID: ${fault._id}`);
      console.log(`      Status: ${fault.status}`);
      console.log(`      Type: ${fault.fault_type} | Location: ${fault.fault_location}`);
      console.log(`      Reported: ${date}`);
      console.log();
    });
    if (pendingFaults.length === 10) {
      console.log("   ... (and more)");
    }
  }
};

// Dry-run mode: show what would be changed without modifying database
const dryRun = async () => {
  console.log("\n🔍 DRY-RUN MODE: Previewing changes (no database modifications)");
  console.log("═".repeat(80));
  
  const stats = await getFaultStatistics();
  
  displayStatistics(stats);
  
  if (stats.nonResolved === 0) {
    console.log("\n✅ No non-resolved faults found. Nothing to update.");
    return false;
  }
  
  console.log(`\n⚠️  This operation will mark ${stats.nonResolved} fault(s) as resolved.`);
  
  await displaySampleFaults();
  
  return true;
};

// Execute the update: mark all non-resolved faults as resolved
const executeUpdate = async () => {
  console.log("\n🚀 EXECUTING UPDATE: Marking all non-resolved faults as resolved");
  console.log("═".repeat(80));
  
  const beforeStats = await getFaultStatistics();
  
  if (beforeStats.nonResolved === 0) {
    console.log("\n✅ No non-resolved faults found. Nothing to update.");
    return;
  }
  
  console.log("\n📊 Before Update:");
  displayStatistics(beforeStats, "Before");
  
  // Update all non-resolved faults
  const updateResult = await Fault.updateMany(
    {
      status: { $in: ["waiting", "pending_confirmation", "assigned"] }
    },
    {
      $set: { status: "resolved" }
    }
  );
  
  console.log(`\n✅ Successfully updated ${updateResult.modifiedCount} fault(s).`);
  
  const afterStats = await getFaultStatistics();
  
  console.log("\n📊 After Update:");
  displayStatistics(afterStats, "After");
  
  console.log("\n✅ All pending faults have been marked as resolved!");
};

// Main function
async function resolveAllPendingFaults() {
  try {
    // Check if MONGO_URI is defined
    if (!process.env.MONGO_URI) {
      console.error("\n❌ Error: MONGO_URI environment variable is not defined!");
      console.error("   Please ensure your .env file exists in the backend directory");
      console.error("   and contains: MONGO_URI=mongodb://...");
      process.exit(1);
    }

    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    
    // Step 1: Dry-run to show what would be changed
    console.log("\n" + "═".repeat(80));
    console.log("🔧 FAULT CLEANUP SCRIPT - Resolve All Pending Faults");
    console.log("═".repeat(80));
    
    const hasNonResolved = await dryRun();
    
    if (!hasNonResolved) {
      console.log("\n✅ No action needed. Exiting...");
      await mongoose.connection.close();
      rl.close();
      process.exit(0);
    }
    
    // Step 2: Ask for confirmation
    console.log("\n" + "⚠️".repeat(40));
    console.log("⚠️  WARNING: This operation will permanently change fault statuses!");
    console.log("⚠️".repeat(40));
    
    const confirmed = await askConfirmation("\n❓ Do you want to proceed with updating the database? (yes/no): ");
    
    if (!confirmed) {
      console.log("\n❌ Operation cancelled by user. No changes made.");
      await mongoose.connection.close();
      rl.close();
      process.exit(0);
    }
    
    // Step 3: Execute the update
    await executeUpdate();
    
    // Close connections
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
    rl.close();
    
    console.log("\n✅ Script completed successfully!");
    process.exit(0);
    
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    if (err.stack) {
      console.error("\nStack trace:", err.stack);
    }
    rl.close();
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

// Run the script
resolveAllPendingFaults();

