import { SecretNetworkClient, Wallet } from "secretjs";
import * as dotenv from "dotenv";
import * as fs from "fs";

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

const uploadContract = async (contract_wasm: Buffer): Promise<{ code_id: string; code_hash?: string }> => {
  const tx = await secretjs.tx.compute.storeCode(
    {
      sender: wallet.address,
      wasm_byte_code: contract_wasm,
      source: "",
      builder: "",
    },
    { gasLimit: 4_000_000 }
  );

  if (tx.code !== 0) {
    throw new Error(`Upload failed: ${tx.rawLog}`);
  }

  const codeId = tx.arrayLog!.find((log) => log.type === "message" && log.key === "code_id")!.value;
  console.log("Code ID:", codeId);

  const contractCodeHash = (await secretjs.query.compute.codeHashByCodeId({ code_id: codeId })).code_hash;
  console.log("Code hash:", contractCodeHash);

  return { code_id: codeId, code_hash: contractCodeHash };
};

export const main = async (): Promise<void> => {
  const contractWasm = fs.readFileSync("../contract/contract.wasm.gz");
  const { code_id, code_hash } = await uploadContract(contractWasm);
  console.log("Uploaded successfully!");
  console.log("Code ID:", code_id);
  console.log("Code hash:", code_hash);
};

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});