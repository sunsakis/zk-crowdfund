# Zero-Knowledge Crowdfunding Platform with Token Support

A production-ready privacy-focused crowdfunding platform built on Partisia Blockchain that keeps individual contributions private while enabling actual token transfers. This implementation leverages zero-knowledge proofs for privacy and the MPC-20 token standard for handling real funds.

## Key Features

- **Token-based Funding**: Uses the MPC-20 token standard for real value transfers
- **Privacy-Preserving Contributions**: Individual contribution amounts remain completely private
- **Threshold-Based Reveal**: Total raised amount only revealed if the campaign is successful
- **Escrow Functionality**: Tokens held in contract until campaign ends with appropriate disbursement
- **Contribution Verification**: Contributors can verify their participation without revealing amounts

## How It Works

1. **Setup Phase**: 
   - Project owner initializes the contract with project details, funding target, deadline, and token address
   - Contributors must approve the contract to spend tokens on their behalf

2. **Active Phase**:
   - Owner explicitly starts the campaign
   - Contributors submit funds as confidential inputs using zero-knowledge proofs
   - Each contribution triggers a token transfer from contributor to contract
   - Contribution amounts remain private, stored as encrypted data on the blockchain

3. **Computation Phase**:
   - When the campaign ends (deadline reached or owner decision), a secure multi-party computation sums all contributions
   - No individual contribution is ever revealed during this process

4. **Completed Phase**:
   - Total raised amount is revealed only if the campaign is successful
   - If successful: Owner can withdraw all funds to their wallet
   - If unsuccessful: Contributors can claim refunds of their exact contributions

## Contract Functions

### Owner Functions
- `initialize`: Deploy the contract with project parameters
- `start_campaign`: Transition from Setup to Active state
- `end_campaign`: End the campaign and begin computation
- `withdraw_funds`: Withdraw funds if campaign was successful

### Contributor Functions
- `add_contribution`: Make a private contribution (requires token approval first)
- `claim_refund`: Claim refund if campaign failed
- `verify_my_contribution`: Verify your contribution was included without revealing amount

### Automatic Callbacks
- `inputted_variable`: Processes token transfer after contribution is confirmed
- `sum_compute_complete`: Handles computation completion
- `open_sum_variable`: Processes the computation result

## MPC-20 Token Integration

This implementation uses the MPC-20 token standard for handling real value transfers:

1. **Token Approval**: Contributors must first approve the campaign contract to spend tokens
2. **Token Transfer**: When contributing, tokens are transferred from contributor to contract
3. **Token Escrow**: Contract holds tokens until campaign completion
4. **Token Distribution**: Based on campaign outcome, tokens are either:
   - Transferred to project owner (successful campaign)
   - Returned to contributors (failed campaign)

## Privacy Considerations

- Individual contribution amounts are never revealed on-chain
- Only the campaign owner and the specific contributor know each contribution amount
- The sum of all contributions is only revealed if the campaign is successful
- Zero-knowledge proofs ensure the integrity of the calculation without compromising privacy

## Usage Flow

1. Deploy the contract with project details and token address
2. Owner calls `start_campaign` to begin accepting contributions
3. Contributors first approve tokens, then make contributions
4. Campaign ends (automatically at deadline or manually by owner)
5. ZK computation calculates total contributions
6. If successful, owner withdraws funds
7. If unsuccessful, contributors claim refunds

## Frontend Integration

The frontend client provides a complete interface for interacting with the contract:

- Connect using private key or wallet
- View campaign details
- Approve tokens for contribution
- Make private contributions
- End campaign (owner or after deadline)
- Withdraw funds or claim refunds
- Verify contributions without revealing amounts

## Deployment Instructions

### Prerequisites
- Partisia Blockchain account with gas
- Access to MPC-20 token contract

### Deploy Campaign Contract
```bash
cargo partisia-contract transaction deploy --gas 10000000 --privatekey Account-A.pk \
  target/wasm32-unknown-unknown/release/zk_crowdfunding_token.pbc \
  "Project Title" "Project Description" "Token_Contract_Address" 10000 1767225600000
```

### Start Campaign
```bash
cargo partisia-contract transaction action --gas 20000 --privatekey Account-A.pk \
  CONTRACT_ADDRESS_HERE start_campaign
```

### Approve Tokens (For Contributors)
```bash
cargo partisia-contract transaction action --gas 10000 --privatekey Account-B.pk \
  TOKEN_ADDRESS_HERE approve CONTRACT_ADDRESS_HERE 500
```

### Make Contribution
```bash
cargo partisia-contract transaction action --gas 100000 --privatekey Account-B.pk \
  CONTRACT_ADDRESS_HERE add_contribution 500
```

### End Campaign
```bash
cargo partisia-contract transaction action --gas 30000 --privatekey Account-A.pk \
  CONTRACT_ADDRESS_HERE end_campaign
```

### Withdraw Funds (If Successful)
```bash
cargo partisia-contract transaction action --gas 30000 --privatekey Account-A.pk \
  CONTRACT_ADDRESS_HERE withdraw_funds
```

### Claim Refund (If Unsuccessful)
```bash
cargo partisia-contract transaction action --gas 30000 --privatekey Account-B.pk \
  CONTRACT_ADDRESS_HERE claim_refund
```

## Security Considerations

- The contract maintains strict access control for sensitive operations
- Zero-knowledge proofs ensure computation integrity
- Token transfers require explicit approval before contributing
- Event logging provides transparency for non-private operations
- Deadline enforcement prevents premature campaign termination by non-owners
- Contribution uniqueness prevents double-counting/privacy leakage

## Extending the Contract

This implementation can be extended with additional features:

- Multiple token support
- Tiered reward levels
- Governance voting on fund usage
- Time-based milestone funding
- KYC integration via allowlists
- Anonymous whitelisting using zero-knowledge proofs