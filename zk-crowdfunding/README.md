# Zero-Knowledge Crowdfunding Platform

A privacy-focused crowdfunding platform built on Partisia Blockchain that keeps individual contributions private while ensuring transparency in the overall funding process.

## How It Works

1. **Project Creation**: The project owner initializes the contract with project details, funding target, and deadline.

2. **Funding Phase**: Contributors can submit funds as confidential inputs. Each contribution is kept private using zero-knowledge proofs.

3. **Privacy-Preserving Computation**: When the campaign ends (by reaching the deadline or by owner decision), the contract uses secure multi-party computation to tally all contributions without revealing individual amounts.

4. **Threshold Reveal**: The total raised amount is only revealed when the computation is complete. The success of the campaign is determined by comparing this total to the funding target.

5. **Fund Distribution**: If the funding target is met, the project owner can withdraw the funds. Otherwise, the project is considered unsuccessful.

## Key Privacy Features

- **Confidential Contributions**: Individual contribution amounts remain private throughout the entire process.
- **Threshold-Based Reveal**: The total raised amount is only revealed after the campaign ends.
- **Fair Verification**: The use of zero-knowledge proofs ensures that the computation is done correctly without exposing sensitive data.

## Setup and Usage

### Deploy a Crowdfunding Contract

1. Build the project:
   ```
   cargo partisia-contract build --release
   ```

2. Deploy the contract:
   ```
   cargo partisia-contract transaction deploy --gas 10000000 --privatekey Account-A.pk target/wasm32-unknown-unknown/release/zk_crowdfunding.pbc "Project Title" "Project Description" 1000 1680000000
   ```
   Where:
   - "Project Title" is the title of your project
   - "Project Description" is the description of your project
   - 1000 is the funding target in your chosen units
   - 1680000000 is the deadline timestamp

### Start the Campaign

After deployment, the project owner can start the campaign:
```
cargo partisia-contract transaction action --gas 20000 --privatekey Account-A.pk {contract-address} start_campaign
```

### Make a Contribution

Contributors can send private contributions:
```
cargo partisia-contract transaction action --gas 100000 --privatekey Account-B.pk {contract-address} add_contribution 100
```
Where 100 is the contribution amount.

### End the Campaign

When the deadline is reached, anyone can end the campaign and start the computation:
```
cargo partisia-contract transaction action --gas 20000 --privatekey Account-A.pk {contract-address} end_campaign
```

### Withdraw Funds

If the campaign was successful, the project owner can withdraw the funds:
```
cargo partisia-contract transaction action --gas 20000 --privatekey Account-A.pk {contract-address} withdraw_funds
```

## Privacy and Security Considerations

- The contract uses secure multi-party computation to protect the privacy of individual contributions.
- Only the aggregate sum is revealed after the campaign is completed.
- The threshold mechanism prevents partial disclosure that could influence contributor behavior.
- All computations are verifiable through zero-knowledge proofs.