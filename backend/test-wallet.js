import { Coinbase } from "@coinbase/coinbase-sdk";
import dotenv from "dotenv";

dotenv.config();

const coinbase = new Coinbase({
  apiKeyName: process.env.CDP_API_KEY_NAME,
  privateKey: process.env.CDP_API_KEY_SECRET,
});

try {
  const wallet = await coinbase.wallets.createWallet({
    name: "Test Wallet",
    type: "developer_managed",
  });
  
  console.log(`Created wallet:`);
  console.log(`  ID: ${wallet.id}`);
  console.log(`  Address: ${wallet.address}`);
} catch (error) {
  console.error("Error creating wallet:", error.message);
  throw error;
}

