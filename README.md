# Givtisia - Private Crowdfunding Campaign Manager

A modern web application for managing private crowdfunding campaigns on Partisia Blockchain. Givtisia provides a user-friendly interface for contributing to campaigns while maintaining privacy through zero-knowledge proofs.

## 🔒 Privacy Features

- **Private Contributions**: Choose between public or private contributions using zero-knowledge proofs
- **Threshold-Based Reveal**: Campaign details remain private until funding target is met
- **Secure Multi-Party Computation**: Leverages Partisia's MPC capabilities for threshold-based revelation

## 🏗️ Architecture

- **Frontend**: React + TypeScript application with modern UI components
- **Blockchain**: Partisia Blockchain testnet with MPC-20 token support
- **Privacy Layer**: Zero-knowledge proofs for private contributions
- **Wallet Integration**: Parti wallet and Metamask support

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (v16 or higher)
- **npm** or **bun**
- **Parti Wallet** or **Metamask** with testnet tokens
- **Bridged Sepolia Testnet ETH** - [ERC-20 to MPC-20 bridge](https://browser.partisiablockchain.com/bridge)

## 🚀 Getting Started

1. Clone the repository:

```bash
git clone https://github.com/your-org/zk-crowdfund.git
cd zk-crowdfund/givtisia
```

2. Install dependencies:

```bash
npm install
# or
bun install
```

3. Start the development server:

```bash
npm run dev
# or
bun run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

## 💡 Usage

1. Connect your wallet (Parti or Metamask)
2. Enter a campaign address (42-character string starting with `03`)
3. View campaign details and contribute:
   - Public contribution: Visible on-chain
   - Private contribution: Hidden using zero-knowledge proofs
4. Track campaign progress and status
5. View transaction history on the Partisia Blockchain explorer

## 🔍 Finding Campaigns

Campaign addresses can be found:

- From the campaign creator
- On the Partisia Blockchain explorer
- Through campaign sharing links

## 🛠️ Development

- Built with React + TypeScript
- Uses Tailwind CSS for styling
- Implements Partisia Blockchain SDK for contract interactions
- Supports both public and private transactions

## 📝 License

MIT License - see LICENSE file for details
