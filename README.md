# ZK Crowdfunding Platform

A privacy-focused crowdfunding platform built on Partisia Blockchain that keeps individual contributions private while ensuring transparency in the overall funding process.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

ZK Crowdfunding leverages zero-knowledge proofs and secure multi-party computation to create a crowdfunding platform where:

- 🔒 Individual contribution amounts remain private
- 🔍 Total raised funds are verifiably calculated
- ✅ The success or failure of campaigns is transparently determined
- 🛡️ All computations are verified cryptographically

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
- **Contributor Verification**: Contributors can verify their participation without revealing contribution amounts.

## Project Structure

```
zk-crowdfunding/
├── src/
│   ├── contract.rs        # Main contract code
│   └── zk_compute.rs      # ZK computation for tallying contributions
├── frontend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── client/    # Blockchain API clients
│   │   │   ├── components/# React components
│   │   │   ├── contract/  # Contract interface code
│   │   │   ├── shared/    # Shared utilities
│   │   │   ├── App.tsx    # Main React application
│   │   │   └── Main.ts    # Entry point for non-React version
│   ├── public/
│   └── package.json
└── Cargo.toml
```

## Setup and Usage

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) (v16+)
- [Partisia Blockchain Tools](https://partisiablockchain.gitlab.io/documentation/smart-contracts/getting-started/installation.html)

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

## Frontend Development

1. Navigate to the frontend directory:
   ```
   cd zk-crowdfunding-frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. The application will be available at http://localhost:8081

## Technical Details

### Zero-Knowledge Proofs

The contract uses Partisia Blockchain's ZK capabilities to keep contribution amounts private. Each contribution is stored as a secret variable with metadata to identify it as a contribution.

```rust
#[zk_on_secret_input(shortname = 0x40)]
fn add_contribution(
    context: ContractContext,
    state: ContractState,
    zk_state: ZkState<SecretVarType>,
) -> (
    ContractState,
    Vec<EventGroup>,
    ZkInputDef<SecretVarType, Sbi32>,
) {
    // Check campaign status
    assert_eq!(
        state.status, CampaignStatus::Active {},
        "Contributions can only be made when campaign is active"
    );
    
    // Create a new secret input definition
    let input_def =
        ZkInputDef::with_metadata(Some(SHORTNAME_INPUTTED_VARIABLE), SecretVarType::Contribution {});
    
    (state, vec![], input_def)
}
```

### Secure Multi-Party Computation

When the campaign ends, a secure computation is performed to sum all contributions without revealing individual amounts:

```rust
#[zk_compute(shortname = 0x61)]
pub fn sum_contributions() -> Sbi32 {
    // Initialize state
    let mut total_contributions: Sbi32 = Sbi32::from(0);

    // Sum each contribution
    for variable_id in secret_variable_ids() {
        if load_metadata::<u8>(variable_id) == CONTRIBUTION_VARIABLE_KIND {
            let contribution_amount = load_sbi::<Sbi32>(variable_id);
            total_contributions = total_contributions + contribution_amount;
        }
    }

    total_contributions
}
```

## Privacy and Security Considerations

- The contract uses secure multi-party computation to protect the privacy of individual contributions.
- Only the aggregate sum is revealed after the campaign is completed.
- The threshold mechanism prevents partial disclosure that could influence contributor behavior.
- All computations are verifiable through zero-knowledge proofs.
- Contributors can verify their participation without revealing contribution amounts.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Partisia Blockchain for providing the infrastructure for privacy-preserving smart contracts
- The MPC and ZK communities for their research and tools