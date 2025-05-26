# ZK Crowdfunding Platform

A contract state privacy-preserving crowdfunding platform built on Partisia Blockchain that keeps individual contributions private until a predefined amount threshold is met while enabling transparent fund management. This implementation leverages zero-knowledge proofs for privacy and secure multi-party computation (MPC) for threshold-based revelation.

## 🔒 Privacy Features


- **Full Contract State Privacy**: No campaign details are leaked by the contract state until the threshold is met
- **Threshold-Based Reveal**: Total raised amount only revealed only if the campaign reaches its funding target
- **Zero-Knowledge Proofs**: Individual contribution amounts are hidden in encrypted variables

## 🏗️ Architecture

- **Smart Contract**: Written in Rust using Partisia's contract SDK with ZK computation support
- **Frontend**: TypeScript web application with Parti and Metamask wallet integrations
- **Blockchain**: Partisia Blockchain testnet with MPC-20 token support
- **Privacy Layer**: Zero-knowledge proofs for contribution privacy and multi-party computation for threshold revelation

## 📋 Prerequisites

Before you begin, ensure you have the following:

- **Node.js** (v16 or higher)
- **npm**
- **Rust** (latest stable version)
- **Git**
- **Bridged Sepolia Testnet ETH** (for demo purposes) - [ERC-20 to MPC-20 bridge](https://browser.partisiablockchain.com/bridge)

### Rust Setup

```bash

# Navigate to contract directory
cd zk-crowdfund

# Build the contract
cargo partisia-contract build --release

# Create a new account
cargo partisia-contract account create

# Deploy the contract (inputs: gas allocation, your account name, compiled contract location, campaign name, campaign description, MPC-20 token address, funding target in wei)
cargo partisia-contract transaction deploy --gas 10000000 --privatekey YOUR_ACCOUNT_NAME.pk target/wasm32-unknown-unknown/release/zk_crowdfunding.pbc "YOUR CAMPAIGN NAME" "your campaign description" "0117f2ccfcb0c56ce5b2ad440e879711a5ac8b64a6" 10

# Navigate to frontend directory
cd zk-crowdfunding-frontend

# Install dependencies
npm install

# Launch the frontend
npm start