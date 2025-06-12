# Givtisia Frontend

A modern React application for interacting with privacy-preserving crowdfunding campaigns on Partisia Blockchain. Built with React, TypeScript, and Partisia's blockchain SDK.

## Tech Stack

- **Core**: React 18 + TypeScript + Vite
- **Routing**: React Router v7
- **State Management**: Tanstack Query v5
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Blockchain**: Partisia Blockchain SDK + ABI Client
- **Package Manager**: Bun

## Architecture

### Contract Integration

The frontend integrates with crowdfunding contracts through generated ABIs:

- Crowdfunding Contract (`useCampaignContract.ts`)

The contract hook provides:

- Type-safe contract interactions using generated ABIs
- Campaign state management and real-time updates
- Transaction submission for contributions, campaign management
- Support for both public and private (zero-knowledge) contributions
- Multi-step transaction handling with approval flows

### Authentication & Session Management

Located in `src/auth/`:

- `AuthProvider.tsx`: Manages wallet connections and session state
- `useAuth.ts`: Hook for accessing auth context
- `SessionManager.ts`: Handles session persistence and recovery
- `AuthContext.ts`: Type definitions for auth state

### Transaction Management

- `TransactionDialog.tsx`: Simple transaction status dialog
- `StepTransactionDialog.tsx`: Multi-step transaction dialog with progress tracking
- `useTransactionStatus.ts`: Hook for tracking transaction states across shards
  - Implements shard-aware polling
  - Handles transaction event chain traversal
  - Provides real-time status updates with error handling
- `useStepTransactionStatus.ts`: Tracks multiple transactions in sequence

### Shard-Aware Design

The application is designed to work with Partisia's sharded architecture:

- Transactions are submitted to specific shards
- Status polling checks transaction event chains across shards
- Automatic error detection and reporting from transaction failures
- Priority-based shard fallback for reliability

### Privacy-Preserving Contributions

The platform supports two types of contributions:

1. **Public Contributions**: Standard token transfers visible on-chain
2. **Secret Contributions**: Zero-knowledge proof-based contributions that hide:
   - Individual contribution amounts
   - Contributor identities  
   - Total raised amount (until funding target is met)

Secret contributions use a multi-step process:

1. Token approval for the campaign contract
2. Zero-knowledge proof generation and submission
3. Actual token transfer completion

## Development

### Prerequisites

- Node.js 18+
- Bun package manager
- Partisia Blockchain testnet account

### Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Generate contract ABIs:

   ```bash
   # Build and generate ABI
   cd ../crowdfund && cargo pbc build --release && \
   cargo pbc abi codegen --ts target/wasm32-unknown-unknown/release/crowdfund.abi ../givtisia/src/contracts/CrowdfundGenerated.ts --deserialize-rpc
   ```

3. Start development server:

   ```bash
   cd givtisia && bun dev
   ```

### Key Development Patterns

1. **Campaign Management**

   ```typescript
   // Example usage of campaign hooks
   const { contributeSecret, isLoading } = useContributeSecret();
   
   const handleContribute = async () => {
     const result = await contributeSecret({
       crowdfundingAddress: "03...",
       amount: 1000000, // raw token units
       tokenAddress: "01..."
     });
     // StepTransactionDialog handles the multi-step flow
   };
   ```

2. **Multi-Step Transaction Handling**

   ```typescript
   // For secret contributions with multiple steps
   <StepTransactionDialog
     transactionResult={{
       isLoading,
       isSuccess,
       isError,
       error,
       transactionPointer,
       steps: stepsWithStatus,
       allTransactionPointers: secretTransactionIds
     }}
     campaignId={campaignId}
     onClose={handleTransactionComplete}
   />
   ```

3. **Campaign State Display**

   ```typescript
   // Real-time campaign data
   const { data: campaign, isLoading } = useQuery({
     queryKey: ["crowdfunding", campaignId],
     queryFn: () => getCrowdfundingState(campaignId),
     enabled: !!campaignId,
   });
   ```

## Project Structure

```
src/
├── auth/              # Authentication and session management
├── components/        # React components
│   ├── shared/       # Reusable components
│   │   ├── TransactionDialog.tsx      # Simple transaction dialog
│   │   ├── StepTransactionDialog.tsx  # Multi-step transaction dialog
│   │   └── TransactionStepper.tsx     # Step progress component
│   ├── ui/          # shadcn/ui components
│   ├── CampaignCard.tsx               # Campaign display and interaction
│   └── ...
├── hooks/            # Custom hooks
│   ├── useCampaignContract.ts         # Main campaign contract interactions
│   ├── useTransactionStatus.ts        # Single transaction status tracking
│   ├── useStepTransactionStatus.ts    # Multi-transaction status tracking
│   └── useCampaignTransaction.ts      # Transaction utilities
├── contracts/        # Generated ABI types
│   └── CrowdfundGenerated.ts
├── lib/             # Utilities and helpers
├── partisia-config.ts # Blockchain configuration
├── Home.tsx         # Main campaign search interface
└── ...
```

## Features

### Campaign Management

- **Search Campaigns**: Find campaigns by contract address
- **View Campaign Details**: Progress, funding target, contributor count, status
- **Real-time Updates**: Automatic refresh of campaign state

### Contribution System

- **Secret Contributions**: Privacy-preserving contributions using zero-knowledge proofs
- **Token Support**: ETH Sepolia and other ERC-20 compatible tokens
- **Balance Checking**: Automatic balance validation for supported tokens

### Campaign Administration

- **End Campaigns**: Campaign owners can end active campaigns
- **Withdraw Funds**: Campaign owners can withdraw funds from successful campaigns
- **Status Tracking**: Real-time tracking of campaign lifecycle

### Privacy Features

- **Hidden Amounts**: Individual contribution amounts are hidden for secret contributions
- **Threshold Revelation**: Total amount only revealed when funding target is met
- **Anonymous Contributions**: No linkage between contributors and amounts

## Contributing

1. Follow the TypeScript and React patterns established in the codebase
2. Use the existing hooks for contract interactions
3. Implement new features using the transaction dialogs for UX consistency
4. Add proper error handling for blockchain operations
5. Update ABIs when contract interfaces change

## Common Issues

1. **Transaction Not Found**
   - Check the destination shard
   - Verify transaction ID format
   - Ensure proper event chain traversal
   - Check explorer (link below)

2. **Authentication Issues**
   - Clear browser storage
   - Verify wallet connection
   - Check network configuration

3. **Contract Interaction Errors**
   - Verify ABI generation matches contract
   - Check contract address format (42 characters, starts with '03')
   - Validate input parameters and token units

4. **Multi-Step Transaction Failures**
   - Check each step individually in the transaction dialog
   - Verify token approval succeeded before secret contribution
   - Ensure sufficient gas for all steps

## Token Bridge Instructions

The app includes built-in instructions for users to get testnet tokens:

1. **Get ETH on Sepolia testnet** via [Alchemy Sepolia Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
2. **Bridge to Partisia Blockchain** via [Partisia Bridge](https://browser.partisiablockchain.com/bridge)

## Resources

- [Partisia Blockchain Documentation](https://partisia-blockchain.gitbook.io/docs/developers/getting-started)
- [Partisia Explorer](https://browser.testnet.partisiablockchain.com/)
- [React Router Documentation](https://reactrouter.com/)
- [Tanstack Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
