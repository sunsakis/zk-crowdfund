# ZK-Crowdfunding Platform Tutorial

This tutorial guides you through deploying and interacting with the ZK-Crowdfunding platform on Partisia Blockchain. The platform enables privacy-preserving crowdfunding where individual contributions remain confidential while ensuring transparency in the overall funding process.

## Prerequisites

- Access to the Partisia Blockchain development environment
- Account key files (Account-A.pk, Account-B.pk, Account-C.pk) with sufficient gas

## 1. Building the Contract

First, compile the ZK-Crowdfunding contract:

```shell
cargo partisia-contract build --release
```

## 2. Deploying the Crowdfunding Contract

Run the "Deploy Crowdfunding Contract" task by pressing `Ctrl+Shift+B` and selecting the task from the list. You'll need to provide:

- Account key to use for deployment (typically Account-A.pk as the project owner)
- Project title
- Project description
- Funding target amount
- Deadline timestamp (in Unix time)

Alternatively, use the command line:
- At the end of the command put in the timestamp for crowdfunding deadline

```shell
cargo partisia-contract transaction deploy --gas 10000000 --privatekey ../Account-A.pk ../target/wasm32-unknown-unknown/release/zk_crowdfunding.pbc "My First Crowdfunding Project" "This is a test project using privacy-preserving crowdfunding" 1000 1767225600000
```

The deployment will provide a contract address, which you should save for later use.

## 3. Starting the Campaign

After deployment, the project is in "Setup" state. The owner must explicitly start the campaign:

Run the "Start Campaign" task by pressing `Ctrl+Shift+B` and selecting the task from the list. You'll need to provide:

- Account key (must be the same as the deployment key)
- Contract address from the deployment step

Or use the command line:

```shell
cargo partisia-contract transaction action --gas 20000 --privatekey ../Account-A.pk CONTRACT_ADDRESS_HERE start_campaign
```

## 4. Contributing to the Campaign

Now, contributors can make private contributions to the project:

Run the "Submit Contribution" task and provide:

- Account key (can be any account with gas)
- Contract address
- Contribution amount (as a whole number)

Or use the command line:

```shell
cargo partisia-contract transaction action --gas 100000 --privatekey Account-B.pk YOUR_CONTRACT_ADDRESS add_contribution 500
```

Each address can only contribute once to maintain privacy protections.

## 5. Ending the Campaign and Computing Results

When the funding period is over (or at the owner's discretion), the campaign can be ended, which triggers the ZK computation to tally the contributions:

Run the "End Campaign and Compute Results" task and provide:

- Account key (must be owner before deadline, or anyone after deadline)
- Contract address

Or use the command line:

```shell
cargo partisia-contract transaction action --gas 20000 --privatekey Account-A.pk YOUR_CONTRACT_ADDRESS end_campaign
```

After the computation completes (which may take some time), the total raised amount will be revealed, and the contract will determine if the funding target was met.

## 6. Withdrawing Funds (If Successful)

If the campaign was successful (total raised ≥ funding target), the project owner can withdraw the funds:

Run the "Withdraw Funds" task and provide:

- Account key (must be the project owner)
- Contract address

Or use the command line:

```shell
cargo partisia-contract transaction action --gas 20000 --privatekey Account-A.pk YOUR_CONTRACT_ADDRESS withdraw_funds
```

## 7. Using the Web Interface

For a more user-friendly experience, you can use the web interface:

1. Run the "Start Crowdfunding Frontend" task or use:

```shell
cd zk-crowdfunding-frontend
npm install
npm start
```

2. Enter the contract address in the frontend
3. Use your private key to log in
4. The interface will show the project details and allow you to:
   - Make contributions (if the campaign is active)
   - End the campaign (if you're the owner or deadline has passed)
   - Withdraw funds (if you're the owner and the campaign was successful)

## Understanding Privacy Features

The ZK-Crowdfunding platform provides several key privacy features:

1. **Private Contributions**: Individual contribution amounts are never revealed on the blockchain.

2. **Threshold-Based Reveal**: The total raised amount is only revealed after the campaign has ended.

3. **Fair Computation**: The use of zero-knowledge proofs ensures that the computation is done correctly without exposing any individual contribution.

4. **Secure Validation**: The consensus mechanism of Partisia Blockchain ensures that the computation is validated by multiple parties, preventing tampering.

## Advanced Usage and Customization

You can customize the contract for additional features:

1. **Contributor Allowlist**: Modify the contract to only accept contributions from specific addresses.

2. **Multiple Funding Tiers**: Add support for different funding tiers with different rewards.

3. **Time-Based Refunds**: Implement refund mechanisms if the campaign fails to meet its target.

4. **Extended Analytics**: Add more ZK computations to provide additional anonymous analytics about the funding campaign.

For these customizations, you would need to modify the `contract.rs` and `zk_compute.rs` files accordingly.