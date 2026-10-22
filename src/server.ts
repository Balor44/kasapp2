import app from './app';
import { connectDB } from './database/connect';
import { initRecurringPaymentsCron } from './jobs/recurringPayments.cron';
import { KaspaService } from './wallet/kaspa.service';
import { NetworkMismatchError } from './utils/network';
import { validateEnvironment } from './utils/envCheck';


const PORT = process.env.PORT || 3000;


// Validate security critical configuration on startup. Messages name the variable, never its value.
const envReport = validateEnvironment(process.env);
for (const warning of envReport.warnings) {
  console.warn(`[Config warning] ${warning}`);
}
if (envReport.errors.length > 0) {
  for (const error of envReport.errors) {
    console.error(`[FATAL] ${error}`);
  }
  console.error('[FATAL] Fix the configuration above and restart. The server will not start with unsafe settings.');
  process.exit(1);
}


initRecurringPaymentsCron();


const start = async () => {
  await connectDB();

  // Fail closed if the node is on a different network than KASPA_NETWORK.
  // If the node is simply unreachable right now, start anyway: the same check runs on every RPC
  // connection, so no balance is read and no transaction is built against the wrong network.
  try {
    const network = await KaspaService.verifyNetwork();
    console.log(`[Kasapp] Kaspa node network verified: ${network}`);
  } catch (error: any) {
    if (error instanceof NetworkMismatchError) {
      console.error(`[FATAL] ${error.message}`);
      process.exit(1);
    }
    console.warn(`[Kasapp] Could not reach a Kaspa node to verify the network at startup (it will be checked on every operation): ${error?.message || error}`);
  }

  app.listen(PORT, () => {
    console.log(`[Kasapp] Server running on port ${PORT}`);
    console.log(`[Kasapp] Health check at http://localhost:${PORT}/health, readiness at /ready`);
  });
};


start();
