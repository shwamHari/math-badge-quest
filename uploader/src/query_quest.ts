import { SecretNetworkClient, Wallet } from "secretjs";
import * as dotenv from "dotenv";

dotenv.config();
const mnemonic = process.env.MNEMONIC;

if (!mnemonic) {
  throw new Error("MNEMONIC not set in .env");
}

const wallet = new Wallet(mnemonic);
const secretjs = new SecretNetworkClient({
  chainId: "pulsar-3",
  url: "https://pulsar.lcd.secretnodes.com",
  wallet,
  walletAddress: wallet.address,
});

const queryQuest = async (contractAddress: string, codeHash: string, id: number) => {
  try {
    const response = await secretjs.query.compute.queryContract({
      contract_address: contractAddress,
      code_hash: codeHash,
      query: { get_quest: { id } },
    });
    console.log(`Quest for ${contractAddress}:`, response);
  } catch (err) {
    console.error(`Failed to query quest for ${contractAddress}:`, err);
  }
};

export const main = async (): Promise<void> => {
  const codeHash = process.argv[2];
  const addresses = process.argv.slice(3);

  for (const addr of addresses) {
    await queryQuest(addr, codeHash, 1);
  }
};

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});