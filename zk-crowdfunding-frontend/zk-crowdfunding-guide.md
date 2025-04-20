# Privacy-Preserving Crowdfunding Platform Guide

This guide will walk you through the process of using the ZK Crowdfunding platform, a privacy-focused crowdfunding solution built on Partisia Blockchain. The platform allows contributors to keep their individual contribution amounts private while ensuring transparency in the overall funding process.

## Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [Deploying a Crowdfunding Project](#deploying-a-crowdfunding-project)
4. [Starting the Campaign](#starting-the-campaign)
5. [Making Contributions](#making-contributions)
6. [Ending the Campaign](#ending-the-campaign)
7. [Withdrawing Funds](#withdrawing-funds)
8. [Privacy Features Explained](#privacy-features-explained)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, make sure you have:

- Node.js and npm installed
- Cargo and Rust toolchain installed
- The Partisia Blockchain CLI tools (cargo-partisia-contract)
- At least one account with test tokens (in the `.pk` file format)

## Project Setup

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/zk-crowdfunding.git
cd zk-crowdfunding
cargo build --release

# Setup the frontend
cd zk-crowdfunding-frontend
npm install
```

2. Make the deployment script executable:

```bash
chmod +x ../scripts/deploy-crowdfunding.sh
```

## Deploying a Crowdfunding Project

1. Use the deployment script to create a new crowdfunding project:

```bash
cd scripts
./deploy-crowdfunding.sh Account-A.pk "My Project Title" "Project Description" 1000 $(( $(date +%s) + 7*24*60*60 ))
```

This command:
- Uses `Account-A.pk` as the project owner
- Sets the project title and description
- Sets a funding target of 1000 units
- Sets a deadline 7 days from now
  
The script will output your contract address and automatically start the campaign.

2. The script creates a `config.json` file for the frontend. You're ready to start the frontend:

```bash
cd zk-crowdfunding-frontend
npm start
```

## Starting the Campaign

The deployment script automatically starts the campaign. However, if you deployed the contract separately:

1. Start the campaign using the CLI:

```bash
cargo partisia-contract transaction action --gas 20000 --privatekey Account-A.pk YOUR_CONTRACT_ADDRESS start_campaign
```

2. Or use the frontend:
   - Log in with your private key
   - Click the "Start Campaign" button (only visible to the project owner)

## Making Contributions

Contributors can make private contributions without revealing the amount to other users:

1. Using the frontend:
   - Enter the contract address
   - Log in with your private key
   - Enter the contribution amount
   - Click "Contribute"
   
2. Using the CLI:

```bash
cargo partisia-contract transaction action --gas 100000 --privatekey Account-B.pk YOUR_CONTRACT_ADDRESS add_contribution 500
```

**Important Privacy Note**: Each address can only contribute once. This is a design decision to ensure privacy of individual contributions.

## Ending the Campaign

When you're ready to end the campaign:

1. Using the frontend:
   - Log in with your private key (project owner or after deadline)
   - Click "End Campaign & Compute Results"
   
2. Using the CLI:

```bash
cargo partisia-contract transaction action --gas 20000 --privatekey Account-A.pk YOUR_CONTRACT_ADDRESS end_campaign
```

After ending the campaign, the contract will enter a "Computing" state while the ZK computation runs. This may take several minutes. The frontend will automatically refresh to show when computation is complete.

## Withdrawing Funds

If the campaign was successful (raised at least the target amount):

1. Using the frontend:
   - Log in with the project owner's private key
   - Click "Withdraw Funds"
   
2. Using the CLI:

```bash
cargo partisia-contract transaction action --gas 20000 --privatekey Account-A.pk YOUR_CONTRACT_ADDRESS withdraw_funds
```

## Privacy Features Explained

This crowdfunding platform provides several privacy guarantees:

1. **Private Contributions**: Individual contribution amounts are never revealed on the blockchain.

2. **Threshold-Based Reveal**: The total raised amount is only revealed after the campaign has ended.

3. **Zero-Knowledge Proofs**: The computation of the total uses secure multi-party computation to ensure accuracy without revealing individual data.

4. **Consensus Verification**: The Partisia Blockchain validators ensure that the computation was performed correctly.

## Troubleshooting

**Transaction Errors**:
- Make sure your account has enough gas
- Check that you're using the correct contract address
- Verify that the campaign is in the correct state for your action

**Frontend Connection Issues**:
- Ensure the contract address is correct
- Check that you're connected to the testnet
- Verify your private key format is correct

**Computation Delays**:
- ZK computations can take time to complete
- Use the frontend's auto-refresh feature to track progress
- You can also check the contract state manually via CLI

For more detailed help, please reach out on our Discord community.