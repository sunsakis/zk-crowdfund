# ZK Crowdfunding Platform

A production-ready MVP for creating and managing privacy-preserving crowdfunding campaigns on Partisia Blockchain.

## Features

- **Campaign Creation**: Create new ZK crowdfunding campaigns with privacy-preserving contributions
- **Campaign Management**: View and manage your campaigns, start funding periods, end campaigns
- **Private Contributions**: Contribute to campaigns with amounts kept confidential until campaign end
- **Factory Pattern**: Uses a factory contract to create and manage individual campaign contracts

## Architecture

The platform uses two types of contracts:

1. **Factory Contract**: Central contract that creates and tracks all crowdfunding campaigns
2. **Campaign Contracts**: Individual contracts for each crowdfunding project

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.sample .env
```

Edit `.env` and set your factory contract address:
```
REACT_APP_FACTORY_ADDRESS=YOUR_FACTORY_CONTRACT_ADDRESS
```

3. Start the development server:
```bash
npm start
```

## Usage

### Creating a Campaign

1. Connect your wallet using a private key
2. Click "Create Campaign" and fill in:
   - Title and description
   - Category and target amount
   - Deadline
3. Submit to create a new campaign contract

### Contributing to a Campaign

1. Enter a campaign contract address or select from "My Campaigns"
2. Enter contribution amount
3. Submit private contribution

### Managing Campaigns

Campaign owners can:
- Start the campaign to begin accepting contributions
- End the campaign to trigger MPC computation
- Withdraw funds if the target is met

## Configuration

The application uses the following environment variables:

- `REACT_APP_FACTORY_ADDRESS`: Factory contract address (required)
- `REACT_APP_DEFAULT_CAMPAIGN_ADDRESS`: Optional default campaign to load
- `REACT_APP_RPC_NODE_URL`: Partisia Blockchain node URL
- `REACT_APP_BROWSER_URL`: Blockchain explorer URL

## Privacy Features

- Individual contribution amounts remain private
- Total raised amounts only revealed after campaign ends
- Zero-knowledge proofs ensure correct computation
- Fair verification through MPC