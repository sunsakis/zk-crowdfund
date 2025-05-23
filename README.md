# ZK Crowdfunding Platform

A privacy-preserving crowdfunding platform built on Partisia Blockchain that keeps individual contributions private while enabling transparent fund management. This implementation leverages zero-knowledge proofs for privacy and secure multi-party computation (MPC) for threshold-based revelation.

## 🔒 Privacy Features

- **Confidential Contributions**: Individual contribution amounts remain completely private
- **Threshold-Based Reveal**: Total raised amount only revealed if the campaign reaches its funding target
- **Zero-Knowledge Proofs**: Contributors can verify their participation without revealing amounts
- **Secure Escrow**: Funds held in smart contract until campaign completion
- **Private Refunds**: Failed campaigns allow contributors to claim exact refunds without amount disclosure

## 🏗️ Architecture

- **Smart Contract**: Written in Rust using Partisia's contract SDK with ZK computation support
- **Frontend**: TypeScript/JavaScript web application with wallet integration
- **Blockchain**: Partisia Blockchain testnet with MPC-20 token support
- **Privacy Layer**: Zero-knowledge proofs for contribution privacy and threshold revelation

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Rust** (latest stable version)
- **Git**

### Rust Setup

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install Partisia contract tools
cargo install --git https://gitlab.com/partisiablockchain/language/contract-sdk.git cargo-partisia-contract

# Navigate to contract directory
cd contracts/zk-crowdfund

# Build the contract
cargo partisia-contract build --release

# The built contract will be in target/wasm32-unknown-unknown/release/

# Navigate to frontend directory
cd ../../zk-crowdfunding-frontend

# Install dependencies
npm install

# Or if using yarn
yarn install

# From the contracts/zk-crowdfund directory
# Replace the private key and addresses with your testnet values

cargo partisia-contract transaction deploy \
  --gas 10000000 \
  --privatekey YOUR_PRIVATE_KEY.pk \
  target/wasm32-unknown-unknown/release/zk_crowdfunding.pbc \
  "Test Campaign" \
  "A test crowdfunding campaign for development" \
  "TOKEN_CONTRACT_ADDRESS" \
  1000 \
  1767225600000