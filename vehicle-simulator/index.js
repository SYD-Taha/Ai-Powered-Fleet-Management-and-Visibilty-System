import dotenv from 'dotenv';
import vehicleSimulator from './services/vehicleSimulator.js';

dotenv.config();

console.log('╔════════════════════════════════════════╗');
console.log('║   Fleet Vehicle Movement Simulator     ║');
console.log('╚════════════════════════════════════════╝\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down simulator...');
  vehicleSimulator.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Shutting down simulator...');
  vehicleSimulator.stop();
  process.exit(0);
});

// Start simulator
(async () => {
  try {
    await vehicleSimulator.initialize();
    await vehicleSimulator.start();
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
})();