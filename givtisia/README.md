# Sekiva Frontend

A modern React application for interacting with Sekiva's privacy-preserving voting system on Partisia Blockchain. Built with React, TypeScript, and Partisia's blockchain SDK.

## Tech Stack

- **Core**: React 18 + TypeScript + Vite
- **Routing**: React Router v7
- **State Management**: Tanstack Query v5
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Blockchain**: Partisia Blockchain SDK + ABI Client
- **Package Manager**: Bun

## Architecture

### Contract Integration

The frontend integrates with three main contracts through generated ABIs:

- Factory Contract (`useFactoryContract.ts`)
- Organization Contract (`useOrganizationContract.ts`)
- Ballot Contract (`useBallotContract.ts`)

Each contract has a dedicated hook that:

- Uses generated ABIs for type-safe contract interactions
- Handles contract state management
- Manages transaction submission
- Provides real-time updates

### Authentication & Session Management

Located in `src/auth/`:

- `AuthProvider.tsx`: Manages wallet connections and session state
- `useAuth.ts`: Hook for accessing auth context
- `SessionManager.ts`: Handles session persistence and recovery
- `AuthContext.ts`: Type definitions for auth state

### Transaction Management

- `TransactionDialog.tsx`: Reusable dialog for transaction status and feedback
- `useTransactionStatus.ts`: Hook for tracking transaction states across shards
  - Implements shard-aware polling
  - Handles contract address derivation
  - Provides real-time status updates

### Shard-Aware Design

The application is designed to work with Partisia's sharded architecture:

- Transactions are submitted to specific shards
- Status polling checks multiple shards for transaction updates
- Contract addresses are derived based on transaction IDs and contract type
- Priority-based shard fallback for reliability

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
   cd ../ballot && cargo pbc build --release && \
   cargo pbc abi codegen --ts target/wasm32-unknown-unknown/release/ballot.abi ../sekiva-frontend/src/contracts/BallotGenerated.ts --deserialize-rpc
   ```

3. Start development server:

   ```bash
   cd sekiva-fronted && bun dev
   ```

### Key Development Patterns

1. **Contract Hooks**

   ```typescript
   // Example usage of a contract hook
   const { deployOrganization, isLoading } = useFactoryContract();
   
   const handleDeploy = async () => {
     const tx = await deployOrganization({
       name: "My Org",
       description: "Description"
     });
     // TransactionDialog handles the rest
   };
   ```

2. **Transaction Handling**

   ```typescript
   // TransactionDialog usage
   <TransactionDialog
     action="deploy"
     id={txId}
     destinationShard={shard}
     trait="collective"
     onSuccess={handleSuccess}
   />
   ```

3. **Authentication**

   ```typescript
   const { connect, account, isConnected } = useAuth();
   ```

## Project Structure

```
src/
├── auth/              # Authentication and session management
├── components/        # React components
│   ├── shared/       # Reusable components
│   ├── ui/          # shadcn/ui components
│   └── ...
├── hooks/            # Custom hooks
│   ├── useFactoryContract.ts
│   ├── useOrganizationContract.ts
│   ├── useBallotContract.ts
│   └── useTransactionStatus.ts
├── lib/             # Utilities and helpers
├── partisia-config.ts # Blockchain configuration
└── ...
```

## Contributing

1. Follow the TypeScript and React patterns established in the codebase
2. Use the existing hooks for contract interactions
3. Implement new features using the transaction dialog for UX consistency
4. Add proper error handling for blockchain operations
5. Update ABIs when contract interfaces change

## Common Issues

1. **Transaction Not Found**
   - Check the destination shard
   - Verify transaction ID format
   - Ensure proper contract address derivation
   - Check explorer (link below)

2. **Authentication Issues**
   - Clear browser storage
   - Verify wallet connection
   - Check network configuration

3. **Contract Interaction Errors**
   - Verify ABI generation
   - Check contract address
   - Validate input parameters

## Resources

- [Partisia Blockchain Documentation](https://partisia-blockchain.gitbook.io/docs/developers/getting-started)
- [Partisia Explorer](https://browser.testnet.partisiablockchain.com/)
- [React Router Documentation](https://reactrouter.com/)
- [Tanstack Query Documentation](https://tanstack.com/query/latest)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
