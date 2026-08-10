// Loads .env using Node's built-in loader (no dotenv dependency). Import once at entry.
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envPath)) process.loadEnvFile(envPath);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY. Copy .env.example to .env and set it.");
  process.exit(1);
}
