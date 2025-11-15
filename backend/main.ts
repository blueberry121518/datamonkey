import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";

dotenv.config();

// Initialize the CDP client, which automatically loads
// the API Key and Wallet Secret from the environment
// variables.
const cdp = new CdpClient();

const account = await cdp.evm.createAccount();

console.log(`Created EVM account: ${account.address}`);

