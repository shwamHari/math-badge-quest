# 🔢 🧮 🥇 Math Badge Quest

A decentralised application (dApp) on Secret Network's Pulsar-3 testnet for gamified math learning. Users solve arithmetic problems (addition, subtraction, multiplication, division) to earn private, CW-721-compatible NFT badges, leveraging Secret Network's privacy-focused smart contracts.

## 📋 Overview

- 🧠 **Smart Contract**: Built with CosmWasm, deployed on Pulsar-3, with four instances (one per operation: +, −, ×, ÷).
- 💻 **Frontend**: React app using SecretJS for blockchain interaction, Keplr for wallet authentication, and Tailwind CSS for styling.
- ⭐ **Features**: Solve five-question quests and earn NFT badges

## Demo 🎥



https://github.com/user-attachments/assets/78af9114-783c-4a89-a831-378fea44d644




## 👥 Roles
- 👑 **Owner**: Adds quests via `AddQuest` (restricted to owner address).
- 🧑 **Users**: Connect Keplr wallet, solves math quests, earns and views NFT badges.


## 🛠️ Setup & Usage

### ⚙️ Prerequisites
- Rust (for contract compilation)
- Node.js and npm (for frontend and uploader scripts)
- Docker (for reproducible contract builds)
- Keplr wallet configured for Pulsar-3 testnet
- `.env` files in `contract/tests/`, `uploader/`, and `frontend/` (see below)

### 📦 Installation and Pipeline
1. 📥 **Clone the Repository**:
   ```bash
   git clone https://eng-git.canterbury.ac.nz/sha331/math-badge-quest.git
   cd math-badge-quest
   ```

2. 🔧 **Build and Test Smart Contract**:
   - Create `contract/tests/.env`:
     ```
     MNEMONIC=<your_wallet_mnemonic>
     ```
   - Run commands:
     ```bash
     cd contract
     cargo run --bin schema --features schema  # Generate contract schemas
     cargo test  # Run unit tests
     make build-mainnet-reproducible # Build optimized contract
     cd tests
     npm install
     npm run test  # Run integration tests
     ```

3. 🚀 **Deploy Contract**:
   - Create `uploader/.env`:
     ```
     MNEMONIC=<your_wallet_mnemonic>
     ```
   - Deploy:
     ```bash
     cd ../../uploader
     npm install  # Install dependencies
     npm run build  # Build uploader scripts
     npm run upload  # Upload contract to Pulsar-3
     npm run instantiate <Code ID> <Code Hash>  # Instantiate contracts for each operation
     ```
   - Note contract addresses for `+`, `-`, `*`, `/`. You will need them for `frontend/.env`
   - Query contracts to confirm creation:
     ```bash
     node dist/query_quest.js <Code Hash> <+ contract address> <- contract address> <* contract address> </ contract address>
     ```

4. 🌐 **Run Frontend**:
   - Create `frontend/.env`:
     ```
     VITE_CHAIN_ID=pulsar-3
     VITE_LCD_URL=https://pulsar.lcd.secretnodes.com
     VITE_CODE_HASH=<Code Hash>
     VITE_CONTRACT_ADDRESS_ADD=<+ contract address>
     VITE_CONTRACT_ADDRESS_SUB=<- contract address>
     VITE_CONTRACT_ADDRESS_MUL=<* contract address>
     VITE_CONTRACT_ADDRESS_DIV=</ contract address>
     ```
   - Start the frontend:
     ```bash
     cd ../frontend
     npm install  # Install dependencies
     npm run dev  # Start development server
     ```

## 💻 Usage

1. 🔗 **Access the dApp**:
   - Open the frontend with the link provided (e.g. `http://localhost:5173`).
   - Connect Keplr wallet via the "Connect Wallet" button.

2. 🧩 **Solve Quests**:
   - From the Home page, select a a quest (+, −, ×, ÷).
   - Solve five arithmetic sub-questions on the Test page, submitting answers via Keplr-signed transactions.
   - Receive feedback (e.g. "Incorrect solution, try again" or "Correct!").

3. 🏅 **View Badges**:
   - Navigate to the Badges page to see earned badges (e.g. "Addition Badge").
