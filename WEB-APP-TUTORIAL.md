# Partisia Blockchain Web Application Guide

This guide will help you create a web application that interacts with a Partisia Blockchain smart contract. We'll build a simple UI that connects to your deployed contract and allows users to interact with it.

## Prerequisites

- Completed the Quick Start Guide with a deployed contract
- Basic knowledge of TypeScript and web development
- Node.js (version 16 or later)
- A deployed contract on the Partisia testnet (we'll use the counter example)

## Step 1: Set Up Your Web Project

Create a new web project using your preferred framework. For simplicity, we'll use a basic setup:

```bash
mkdir counter-webapp
cd counter-webapp
npm init -y
npm install typescript ts-node parcel-bundler --save-dev
npm install @partisiablockchain/abi-client @partisiablockchain/blockchain-api-transaction-client partisia-sdk
```

Create a basic project structure:

```bash
mkdir -p src/config src/services
touch src/index.html src/index.ts
```

## Step 2: Generate TypeScript Code from Contract ABI

After compiling your contract, generate TypeScript bindings from its ABI:

```bash
# Assuming you're in your web project folder with the compiled contract accessible
cargo pbc abi codegen --ts ../example-contracts/rust/counter/target/wasm32-unknown-unknown/release/counter.abi src/generated/CounterContract.ts --deserialize=""
```

This generates TypeScript code that makes it easier to interact with your contract.

### Example ABI output

```typescript
// This file is auto-generated from an abi-file using AbiCodegen.
/* eslint-disable */
// @ts-nocheck
// noinspection ES6UnusedImports
import {
  AbiBitInput,
  AbiBitOutput,
  AbiByteInput,
  AbiByteOutput,
  AbiInput,
  AbiOutput,
  AvlTreeMap,
  BlockchainAddress,
  BlockchainPublicKey,
  BlockchainStateClient,
  BlsPublicKey,
  BlsSignature,
  BN,
  Hash,
  Signature,
  StateWithClient,
  SecretInputBuilder,
} from "@partisiablockchain/abi-client";

type Option<K> = K | undefined;
export class partisia {
  private readonly _client: BlockchainStateClient | undefined;
  private readonly _address: BlockchainAddress | undefined;
  
  public constructor(
    client: BlockchainStateClient | undefined,
    address: BlockchainAddress | undefined
  ) {
    this._address = address;
    this._client = client;
  }
  public deserializeCounterState(_input: AbiInput): CounterState {
    const counter: BN = _input.readU64();
    return { counter };
  }
  public async getState(): Promise<CounterState> {
    const bytes = await this._client?.getContractStateBinary(this._address!);
    if (bytes === undefined) {
      throw new Error("Unable to get state bytes");
    }
    const input = AbiByteInput.createLittleEndian(bytes);
    return this.deserializeCounterState(input);
  }

}
export interface CounterState {
  counter: BN;
}

export function initialize(initialValue: BN): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
    _out.writeU64(initialValue);
  });
}

export function increment(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("82c6e4b30f", "hex"));
  });
}

export function decrement(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("e5eb9c9802", "hex"));
  });
}

export function deserializeState(state: StateWithClient): CounterState;
export function deserializeState(bytes: Buffer): CounterState;
export function deserializeState(
  bytes: Buffer,
  client: BlockchainStateClient,
  address: BlockchainAddress
): CounterState;
export function deserializeState(
  state: Buffer | StateWithClient,
  client?: BlockchainStateClient,
  address?: BlockchainAddress
): CounterState {
  if (Buffer.isBuffer(state)) {
    const input = AbiByteInput.createLittleEndian(state);
    return new partisia(client, address).deserializeCounterState(input);
  } else {
    const input = AbiByteInput.createLittleEndian(state.bytes);
    return new partisia(
      state.client,
      state.address
    ).deserializeCounterState(input);
  }
}
```

## Step 3: Set Up Blockchain Configuration

Create a blockchain configuration file at `src/config/BlockchainConfig.ts`:

```typescript
import { ChainControllerApi, Configuration } from "@partisiablockchain/blockchain-api-transaction-client";

// Configure API client for the testnet
export const CLIENT = new ChainControllerApi(
  new Configuration({ basePath: "https://node1.testnet.partisiablockchain.com" })
);

// Contract address - replace with your deployed contract address
export const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";

// Track current account/wallet connection
let currentAccount: any = undefined;

export const isConnected = () => {
  return currentAccount != null;
};

export const setAccount = (account: any) => {
  currentAccount = account;
};

export const getAccount = () => {
  return currentAccount;
};

export const resetAccount = () => {
  currentAccount = undefined;
};
```

## Step 4: Create a Wallet Service

Create a wallet service to handle connections at `src/services/WalletService.ts`:

```typescript
import PartisiaSdk from "partisia-sdk";
import { CLIENT, setAccount, resetAccount } from "../config/BlockchainConfig";
import { Buffer } from "buffer";

// Interface for connected wallet
export interface ConnectedWallet {
  address: string;
  signAndSendTransaction: (payload: any, cost?: number) => Promise<any>;
}

/**
 * Connect to Partisia Wallet
 */
export const connectPartisiaWallet = async (): Promise<ConnectedWallet> => {
  const partisiaSdk = new PartisiaSdk();
  const connection = await partisiaSdk.connect({
    permissions: ["sign" as any],
    dappName: "Counter App",
    chainId: "Partisia Blockchain Testnet",
  });

  if (!partisiaSdk.connection?.account) {
    throw new Error("Failed to connect to wallet");
  }

  return {
    address: partisiaSdk.connection.account.address,
    signAndSendTransaction: (payload, cost = 0) => {
      return CLIENT.getAccountData(partisiaSdk.connection?.account?.address ?? "").then((accountData) => {
        if (!accountData) throw new Error("Account data was null");

        // Format transaction payload
        const txPayload = {
          cost: String(cost),
          nonce: accountData.nonce,
          validTo: String(new Date().getTime() + 3600000), // 1 hour validity
          address: partisiaSdk.connection?.account?.address ?? ""
        };

        // Serialize transaction
        const serializedTx = serializeTransaction(txPayload, payload.rpc);

        // Sign and send transaction
        return partisiaSdk.signMessage({
          payload: serializedTx.toString("hex"),
          payloadType: "hex",
          dontBroadcast: false,
        })
        .then((value) => ({
          transactionHash: value.trxHash,
        }))
        .catch(() => ({ putSuccessful: false }));
      });
    },
  };
};

/**
 * Handle wallet connection workflow
 */
export const connectWallet = async () => {
  resetAccount();
  
  try {
    const wallet = await connectPartisiaWallet();
    setAccount(wallet);
    return wallet;
  } catch (error) {
    console.error("Connection error:", error);
    throw error;
  }
};

/**
 * Disconnect current wallet
 */
export const disconnectWallet = () => {
  resetAccount();
};

// Helper function to serialize transaction (simplified)
function serializeTransaction(txData: any, rpc: any) {
  // Simplified implementation - in production use the actual serialization from 
  // @partisiablockchain/abi-client
  return Buffer.from("transaction");
}
```

## Step 5: Create Contract Service

Create a service to interact with your contract at `src/services/ContractService.ts`:

```typescript
import { BlockchainAddress } from "@partisiablockchain/abi-client";
import { CLIENT, CONTRACT_ADDRESS, getAccount } from "../config/BlockchainConfig";
import { CounterContract } from "../generated/CounterContract";

/**
 * Get the current counter state
 */
export const getCounterState = async (): Promise<number> => {
  try {
    const state = await CLIENT.getContractState(CONTRACT_ADDRESS);
    const deserializedState = CounterContract.deserializeState(state);
    return deserializedState.counter;
  } catch (error) {
    console.error("Error getting counter state:", error);
    throw error;
  }
};

/**
 * Increment the counter
 */
export const incrementCounter = async (gas = 100000): Promise<string> => {
  const wallet = getAccount();
  
  if (!wallet) {
    throw new Error("Wallet not connected");
  }
  
  // Create the RPC for the increment action
  const rpc = CounterContract.increment();
  
  // Send the transaction
  try {
    const result = await wallet.signAndSendTransaction({
      rpc,
      contractAddress: BlockchainAddress.fromString(CONTRACT_ADDRESS),
    }, gas);
    
    return result.transactionHash;
  } catch (error) {
    console.error("Error incrementing counter:", error);
    throw error;
  }
};
```

## Step 6: Create a Simple UI

Create a basic UI in `src/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Partisia Counter App</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    button {
      background-color: #4CAF50;
      border: none;
      color: white;
      padding: 10px 20px;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 16px;
      margin: 4px 2px;
      cursor: pointer;
      border-radius: 4px;
    }
    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <h1>Partisia Counter App</h1>
  
  <div class="card" id="connection-card">
    <h2>Connect Wallet</h2>
    <p id="connection-status">Not connected</p>
    <button id="connect-wallet-btn">Connect Wallet</button>
    <button id="disconnect-wallet-btn" class="hidden">Disconnect</button>
  </div>
  
  <div class="card hidden" id="contract-card">
    <h2>Counter Contract</h2>
    <p>Current value: <span id="counter-value">Loading...</span></p>
    <button id="increment-btn">Increment</button>
    <p id="transaction-status"></p>
  </div>
  
  <script src="./index.ts"></script>
</body>
</html>
```

## Step 7: Connect All the Pieces

Finally, create the main application file at `src/index.ts`:

```typescript
import { connectWallet, disconnectWallet } from "./services/WalletService";
import { getCounterState, incrementCounter } from "./services/ContractService";
import { isConnected } from "./config/BlockchainConfig";

// DOM Elements
const connectWalletBtn = document.getElementById("connect-wallet-btn") as HTMLButtonElement;
const disconnectWalletBtn = document.getElementById("disconnect-wallet-btn") as HTMLButtonElement;
const connectionStatus = document.getElementById("connection-status") as HTMLParagraphElement;
const contractCard = document.getElementById("contract-card") as HTMLDivElement;
const counterValue = document.getElementById("counter-value") as HTMLSpanElement;
const incrementBtn = document.getElementById("increment-btn") as HTMLButtonElement;
const transactionStatus = document.getElementById("transaction-status") as HTMLParagraphElement;

// Update UI based on connection state
function updateUI() {
  if (isConnected()) {
    connectWalletBtn.classList.add("hidden");
    disconnectWalletBtn.classList.remove("hidden");
    contractCard.classList.remove("hidden");
    updateCounterValue();
  } else {
    connectWalletBtn.classList.remove("hidden");
    disconnectWalletBtn.classList.add("hidden");
    contractCard.classList.add("hidden");
    connectionStatus.textContent = "Not connected";
  }
}

// Update counter value display
async function updateCounterValue() {
  try {
    counterValue.textContent = "Loading...";
    const count = await getCounterState();
    counterValue.textContent = count.toString();
  } catch (error) {
    counterValue.textContent = "Error loading counter";
    console.error(error);
  }
}

// Connect wallet event
connectWalletBtn.addEventListener("click", async () => {
  connectionStatus.textContent = "Connecting...";
  
  try {
    const wallet = await connectWallet();
    connectionStatus.textContent = `Connected: ${wallet.address}`;
    updateUI();
  } catch (error) {
    connectionStatus.textContent = `Connection failed: ${error}`;
  }
});

// Disconnect wallet event
disconnectWalletBtn.addEventListener("click", () => {
  disconnectWallet();
  updateUI();
});

// Increment counter event
incrementBtn.addEventListener("click", async () => {
  transactionStatus.textContent = "Sending transaction...";
  incrementBtn.disabled = true;
  
  try {
    const txHash = await incrementCounter();
    transactionStatus.textContent = `Transaction sent: ${txHash}`;
    
    // Wait a moment and update the counter value
    setTimeout(updateCounterValue, 5000);
  } catch (error) {
    transactionStatus.textContent = `Transaction failed: ${error}`;
  } finally {
    incrementBtn.disabled = false;
  }
});

// Initialize UI
updateUI();
```

## Step 8: Run Your Application

Start your application with:

```bash
npx parcel src/index.html
```

Your application should now be running at http://localhost:1234. You can:

- Connect your Partisia Wallet
- View the current counter value
- Increment the counter with a transaction
- See the updated value after the transaction is confirmed