# ZK-Crowdfunding Frontend

A privacy-focused crowdfunding platform frontend that interacts with the Partisia Blockchain. This application allows users to interact with the ZK-Crowdfunding smart contract, which keeps individual contributions private while ensuring transparency in the overall funding process.

## Features

- **Private Contributions**: Individual contribution amounts are kept confidential using zero-knowledge proofs
- **Threshold-Based Reveal**: Total raised amount is only revealed when the campaign ends
- **Secure Computation**: Uses Partisia's Multi-Party Computation to securely tally all contributions
- **Role-Based Actions**: Project owner has special privileges like starting/ending campaigns and withdrawing funds

## Prerequisites

- Node.js and NPM installed
- Access to a deployed ZK-Crowdfunding contract on Partisia Blockchain
- Private key file for interacting with the blockchain

## Setup and Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/zk-crowdfunding.git
cd zk-crowdfunding/zk-crowdfunding-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `config.json` file in the `src` directory with your contract information:
```json
{
  "contractAddress": "YOUR_CONTRACT_ADDRESS_HERE",
  "blockchain": {
    "rpcNodeUrl": "https://node1.testnet.partisiablockchain.com",
    "browserUrl": "https://browser.testnet.partisiablockchain.com"
  }
}
```

4. Start the development server:
```bash
npm start
```

## Usage Guide

### Connecting to a Contract

1. Enter the contract address in the input field at the top of the application.
2. Click "Set Address" to connect to the contract and load project details.

### Logging In

1. Enter your private key in the login section.
2. Click "Login" to authenticate yourself with the blockchain.

### Project Owner Actions

If you're the project owner, you can:

- **Start Campaign**: Transition the project from Setup to Active state.
- **End Campaign**: Close the funding period and trigger the computation of results.
- **Withdraw Funds**: If the campaign was successful, withdraw the raised funds.

### Contributor Actions

Any user with a private key can:

- **Make a Contribution**: Submit a confidential contribution to the project.
- **View Project Status**: Check the current state of the project, including deadline and funding target.

## Privacy Features

1. **Confidential Contributions**: Individual contribution amounts are never revealed on the blockchain.

2. **Threshold-Based Reveal**: The total raised amount is only revealed after the campaign has ended.

3. **Fair Computation**: The use of zero-knowledge proofs ensures that the computation is done correctly without exposing any individual contribution.

4. **Consensus Verification**: The Partisia Blockchain consensus mechanism ensures that the computation is validated by multiple parties.

## Troubleshooting

### Common Issues:

- **Transaction Errors**: Make sure your private key is correct and has sufficient gas.
- **Contract Not Found**: Verify the contract address is correct and the contract is deployed.
- **Computation Taking Too Long**: ZK computations can take time. The interface will automatically refresh.

## Developer Notes

- The frontend uses React and TypeScript
- API calls are made directly to the Partisia Blockchain nodes
- The auto-refresh mechanism checks for updates every 10 seconds when a computation is in progress

## License

[Insert your license information here]

## Contact

[Your contact information]