import { log } from "../utils/logger";
import { sendWhatsAppNotification } from "./whatsapp.service";

const lastSent = new Map<string, number>();

/** Logs an alert and, at most once per ten minutes per message, WhatsApps the admin. Never throws. */
export async function raiseAlert(message: string): Promise<void> {
  log.error("ALERT " + message);
  const admin = (process.env.ADMIN_PHONE || "").trim();
  if (!admin) return;
  const key = message.slice(0, 80);
  const now = Date.now();
  if (now - (lastSent.get(key) || 0) < 600_000) return;
  lastSent.set(key, now);
  try {
    await sendWhatsAppNotification(admin, `🚨 *KasApp alert*\n${message}`);
  } catch {
    // logging already happened, nothing more to do
  }
}
