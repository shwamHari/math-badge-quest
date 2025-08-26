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

const instantiateContract = async (codeId: string, contractCodeHash: string, operation: string): Promise<string> => {
  const initMsg = { owner: wallet.address, operation };
  const tx = await secretjs.tx.compute.instantiateContract(
    {
      code_id: codeId,
      sender: wallet.address,
      code_hash: contractCodeHash,
      init_msg: initMsg,
      label: `math_quest_${operation}_${Math.ceil(Math.random() * 10000000)}`,
    },
    { gasLimit: 400_000 }
  );

  if (tx.code !== 0) {
    throw new Error(`Instantiation failed for ${operation}: ${tx.rawLog}`);
  }

  const contractAddress = tx.arrayLog!.find(
    (log) => log.type === "message" && log.key === "contract_address"
  )!.value;
  return contractAddress;
};

const addTestQuest = async (contractAddress: string, codeHash: string, id: number, operation: string) => {
  const addQuestMsg = {
    add_quest: { id, operation },
  };
  const tx = await secretjs.tx.compute.executeContract(
    {
      sender: wallet.address,
      contract_address: contractAddress,
      code_hash: codeHash,
      msg: addQuestMsg,
      sent_funds: [],
    },
    { gasLimit: 200_000 }
  );

  if (tx.code !== 0) {
    throw new Error(`Failed to add test quest for ${operation}: ${tx.rawLog}`);
  }

  // Query the quest to get the randomly generated details
  const response = await secretjs.query.compute.queryContract({
    contract_address: contractAddress,
    code_hash: codeHash,
    query: { get_quest: { id } },
  });

  console.log(`Test quest added for ${operation}:`, response);
};

export const main = async (): Promise<void> => {
  if (process.argv.length !== 4) {
    console.error("Expected two arguments: <code_id> <code_hash>");
    process.exit(1);
  }

  const code_id = process.argv[2];
  const code_hash = process.argv[3];

  const operations = ["+", "-", "*", "/"];

  for (const op of operations) {
    const contractAddress = await instantiateContract(code_id, code_hash, op);
    console.log(`Contract address for ${op}:`, contractAddress);
    await addTestQuest(contractAddress, code_hash, 1, op);
  }
};

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});