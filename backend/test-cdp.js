import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";

dotenv.config();

console.log("API Key ID:", process.env.CDP_API_KEY_ID ? "Set" : "Missing");
console.log("API Key Name:", process.env.CDP_API_KEY_NAME ? "Set" : "Missing");
console.log("API Key Secret:", process.env.CDP_API_KEY_SECRET ? "Set" : "Missing");
console.log("Wallet Secret:", process.env.CDP_WALLET_SECRET ? "Set" : "Missing");

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeyName: process.env.CDP_API_KEY_NAME,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET || "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgbfz/z08JiBKrO1agBTGUXjjL/GgILT8NcnMMAPLPWsShRANCAATiItcvvZPNNLlhYSHHRfWmpLgfWFLEVrZz880jAcn9t5iA5sJ04W8nwCWTaXM5LOtwQQLlXiNDcn1CYQELdkVq"
});

try {
  const account = await cdp.evm.createAccount();
  console.log(`Created EVM account: ${account.address}`);
} catch (error) {
  console.error("Error creating account:", error.message);
  if (error.statusCode) {
    console.error("Status code:", error.statusCode);
  }
  throw error;
}

