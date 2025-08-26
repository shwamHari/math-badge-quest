import * as dotenv from "dotenv";
import { Wallet, SecretNetworkClient, BroadcastMode } from "secretjs";
import fs from "fs";
import assert from "assert";

dotenv.config();

interface QueryAnswer {
  operation?: string;
  a?: number;
  b?: number;
  badges?: number[];
  sub_questions?: { operation: string; a: number; b: number }[];
  progress?: boolean[];
}

// Initialize client for Pulsar-3 using .env mnemonic
const initializeClient = async (endpoint: string, chainId: string) => {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) throw new Error("MNEMONIC not set in .env file");
  const wallet = new Wallet(mnemonic);
  const accAddress = wallet.address;
  const client = new SecretNetworkClient({
    url: endpoint,
    chainId: chainId,
    wallet: wallet,
    walletAddress: accAddress,
  });
  console.log(`Initialized client with wallet address: ${accAddress}`);
  return client;
};

// Store and instantiate contract
const initializeContract = async (
  client: SecretNetworkClient,
  contractPath: string
) => {
  const wasmCode = fs.readFileSync(contractPath);
  console.log("Uploading contract");

  const uploadReceipt = await client.tx.compute.storeCode(
    {
      wasm_byte_code: wasmCode,
      sender: client.address,
      source: "",
      builder: "",
    },
    {
      gasLimit: 5_000_000,
      broadcastMode: BroadcastMode.Sync,
    }
  );

  if (uploadReceipt.code !== 0) {
    throw new Error(`Failed to upload contract: ${uploadReceipt.rawLog}`);
  }

  const codeId = Number(
    uploadReceipt.arrayLog!.find(
      (log) => log.type === "message" && log.key === "code_id"
    )!.value
  );
  console.log("Contract codeId: ", codeId);

  const contractCodeHash = (
    await client.query.compute.codeHashByCodeId({ code_id: String(codeId) })
  ).code_hash;
  if (!contractCodeHash) throw new Error("Failed to get code hash");
  console.log(`Contract hash: ${contractCodeHash}`);

  const contract = await client.tx.compute.instantiateContract(
    {
      sender: client.address,
      code_id: codeId,
      init_msg: { owner: client.address },
      code_hash: contractCodeHash,
      label: "math_quest_" + Math.ceil(Math.random() * 10000),
    },
    {
      gasLimit: 1_000_000,
      broadcastMode: BroadcastMode.Sync,
    }
  );

  if (contract.code !== 0) {
    throw new Error(`Failed to instantiate: ${contract.rawLog}`);
  }

  const contractAddress = contract.arrayLog!.find(
    (log) => log.type === "message" && log.key === "contract_address"
  )!.value;
  console.log(`Contract address: ${contractAddress}`);

  return [contractCodeHash, contractAddress] as [string, string];
};

// Initialise and upload contract
async function initializeAndUploadContract() {
  const endpoint = "https://pulsar.lcd.secretnodes.com";
  const chainId = "pulsar-3";
  const client = await initializeClient(endpoint, chainId);
  const [contractHash, contractAddress] = await initializeContract(
    client,
    "../contract.wasm.gz"
  );
  return [client, contractHash, contractAddress] as [
    SecretNetworkClient,
    string,
    string
  ];
}

// Query functions
async function queryQuest(
  client: SecretNetworkClient,
  contractHash: string,
  contractAddress: string,
  id: number,
  subQuestionIndex: number
): Promise<QueryAnswer> {
  const response = (await client.query.compute.queryContract({
    contract_address: contractAddress,
    code_hash: contractHash,
    query: { get_quest: { id, sub_question_index: subQuestionIndex } },
  })) as QueryAnswer;
  if ("err" in response) {
    throw new Error(`Query failed: ${JSON.stringify(response)}`);
  }
  return response;
}

async function queryUserBadges(
  client: SecretNetworkClient,
  contractHash: string,
  contractAddress: string,
  user: string
): Promise<QueryAnswer> {
  const response = (await client.query.compute.queryContract({
    contract_address: contractAddress,
    code_hash: contractHash,
    query: { get_user_badges: { user } },
  })) as QueryAnswer;
  if ("err" in response) {
    throw new Error(`Query failed: ${JSON.stringify(response)}`);
  }
  return response;
}

async function queryUserProgress(
  client: SecretNetworkClient,
  contractHash: string,
  contractAddress: string,
  user: string,
  questId: number
): Promise<QueryAnswer> {
  const response = (await client.query.compute.queryContract({
    contract_address: contractAddress,
    code_hash: contractHash,
    query: { get_user_progress: { user, quest_id: questId } },
  })) as QueryAnswer;
  if ("err" in response) {
    throw new Error(`Query failed: ${JSON.stringify(response)}`);
  }
  return response;
}

// Execute functions
async function addQuestTx(
  client: SecretNetworkClient,
  contractHash: string,
  contractAddress: string,
  id: number,
  operation: string
) {
  const tx = await client.tx.compute.executeContract(
    {
      sender: client.address,
      contract_address: contractAddress,
      code_hash: contractHash,
      msg: { add_quest: { id, operation } },
      sent_funds: [],
    },
    {
      gasLimit: 200_000,
      broadcastMode: BroadcastMode.Sync,
    }
  );
  console.log(`AddQuest TX used ${tx.gasUsed} gas`);
  if (tx.code !== 0) throw new Error(`AddQuest failed: ${tx.rawLog}`);
  return tx;
}

async function submitSolutionTx(
  client: SecretNetworkClient,
  contractHash: string,
  contractAddress: string,
  questId: number,
  subQuestionIndex: number,
  solution: number
) {
  const tx = await client.tx.compute.executeContract(
    {
      sender: client.address,
      contract_address: contractAddress,
      code_hash: contractHash,
      msg: {
        submit_solution: {
          quest_id: questId,
          sub_question_index: subQuestionIndex,
          solution,
        },
      },
      sent_funds: [],
    },
    {
      gasLimit: 200_000,
      broadcastMode: BroadcastMode.Sync,
    }
  );
  console.log(`SubmitSolution TX used ${tx.gasUsed} gas`);
  if (tx.code !== 0) throw new Error(`SubmitSolution failed: ${tx.rawLog}`);
  return tx;
}

// Test functions
async function test_initialization(
  client: SecretNetworkClient,
  contractHash: string,
  contractAddress: string
) {
  const badges = await queryUserBadges(client, contractHash, contractAddress, client.address);
  assert(
    badges.badges?.length === 0,
    `Expected no badges, got ${badges.badges?.length}`
  );
  console.log("Initialization test passed");
}

async function test_add_quest(
  client: SecretNetworkClient,
  contractHash: string,
  contractAddress: string
) {
  await addQuestTx(client, contractHash, contractAddress, 1, "+");
  const quest = await queryQuest(client, contractHash, contractAddress, 1, 0);
  assert(
    quest.operation === "+" && quest.a !== undefined && quest.b !== undefined,
    `Expected quest {+, a, b}, got ${JSON.stringify(quest)}`
  );
  console.log("AddQuest test passed");
}

async function test_submit_solution(
  client: SecretNetworkClient,
  contractHash: string,
  contractAddress: string
) {
  await addQuestTx(client, contractHash, contractAddress, 2, "+");
  // Submit solutions for all 5 sub-questions
  for (let idx = 0; idx < 5; idx++) {
    const quest = await queryQuest(client, contractHash, contractAddress, 2, idx);
    const solution = quest.a! + quest.b!;
    await submitSolutionTx(client, contractHash, contractAddress, 2, idx, solution);
    // Check progress after each submission
    const progress = await queryUserProgress(client, contractHash, contractAddress, client.address, 2);
    const expectedProgress = Array(5).fill(false).map((_, i) => i <= idx);
    assert(
      JSON.stringify(progress.progress) === JSON.stringify(expectedProgress),
      `Expected progress ${expectedProgress}, got ${progress.progress}`
    );
  }
  const badges = await queryUserBadges(client, contractHash, contractAddress, client.address);
  assert(
    badges.badges?.length === 1 && badges.badges[0] === 1,
    `Expected badge [1], got ${JSON.stringify(badges.badges)}`
  );
  console.log("SubmitSolution test passed");
}

async function test_partial_progress() {
  // Initialize a fresh contract
  const [client, contractHash, contractAddress] = await initializeAndUploadContract();
  await addQuestTx(client, contractHash, contractAddress, 3, "-");
  // Submit solutions for first 2 sub-questions
  for (let idx = 0; idx < 2; idx++) {
    const quest = await queryQuest(client, contractHash, contractAddress, 3, idx);
    const solution = quest.a! - quest.b!;
    await submitSolutionTx(client, contractHash, contractAddress, 3, idx, solution);
  }
  const progress = await queryUserProgress(client, contractHash, contractAddress, client.address, 3);
  assert(
    JSON.stringify(progress.progress) === JSON.stringify([true, true, false, false, false]),
    `Expected progress [true, true, false, false, false], got ${progress.progress}`
  );
  const badges = await queryUserBadges(client, contractHash, contractAddress, client.address);
  assert(
    badges.badges?.length === 0,
    `Expected no badges, got ${badges.badges?.length}`
  );
  console.log("PartialProgress test passed");
}

// Run tests
async function runTestFunction(
  tester: (
    client: SecretNetworkClient,
    contractHash: string,
    contractAddress: string
  ) => Promise<void>,
  client: SecretNetworkClient,
  contractHash: string,
  contractAddress: string
) {
  console.log(`Testing ${tester.name}`);
  await tester(client, contractHash, contractAddress);
  console.log(`[SUCCESS] ${tester.name}`);
}

(async () => {
  try {
    const [client, contractHash, contractAddress] = await initializeAndUploadContract();
    await runTestFunction(test_initialization, client, contractHash, contractAddress);
    await runTestFunction(test_add_quest, client, contractHash, contractAddress);
    await runTestFunction(test_submit_solution, client, contractHash, contractAddress);
    await runTestFunction(test_partial_progress, client, contractHash, contractAddress);
  } catch (e) {
    console.error("Test failed:", e);
    process.exit(1);
  }
})();