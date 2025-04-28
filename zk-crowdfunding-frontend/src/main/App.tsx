import React, { useState, useEffect } from 'react';
import { BlockchainAddress, AbiBitOutput, AbiByteOutput, AbiByteInput } from '@partisiablockchain/abi-client';
import { BlockchainTransactionClient, SenderAuthentication } from '@partisiablockchain/blockchain-api-transaction-client';
import { RealZkClient, Client } from '@partisiablockchain/zk-client';
import { ec as EC } from 'elliptic';
import { Buffer } from 'buffer';

// Initialize elliptic curve
const ec = new EC('secp256k1');

// Campaign status enum matching the contract
enum CampaignStatus {
  Active = 0,
  Computing = 1,
  Completed = 2
}

interface ContractState {
  owner: BlockchainAddress;
  title: string;
  description: string;
  fundingTarget: number;
  deadline: number;
  status: CampaignStatus;
  totalRaised?: number;
  numContributors?: number;
  isSuccessful: boolean;
}

const ZKCrowdfundingApp = () => {
  const [contractAddress, setContractAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [contractState, setContractState] = useState<ContractState | null>(null);
  const [transactionClient, setTransactionClient] = useState<BlockchainTransactionClient | null>(null);
  const [zkClient, setZkClient] = useState<RealZkClient | null>(null);
  const [senderAuth, setSenderAuth] = useState<SenderAuthentication | null>(null);
  const [walletAddress, setWalletAddress] = useState('');

  const TESTNET_URL = "https://node1.testnet.partisiablockchain.com";

  // Deserialize contract state using proper ABI decoding
  const deserializeContractState = (buffer: Buffer): ContractState => {
    const input = AbiByteInput.createLittleEndian(buffer);
    
    const owner = input.readAddress();
    const title = input.readString();
    const description = input.readString();
    const fundingTarget = input.readU32();
    const deadline = input.readU64().toNumber();
    const status = input.readU8() as CampaignStatus;
    
    let totalRaised: number | undefined = undefined;
    const totalRaisedExists = input.readBoolean();
    if (totalRaisedExists) {
      totalRaised = input.readU32();
    }
    
    let numContributors: number | undefined = undefined;
    const numContributorsExists = input.readBoolean();
    if (numContributorsExists) {
      numContributors = input.readU32();
    }
    
    const isSuccessful = input.readBoolean();
    
    return {
      owner,
      title,
      description,
      fundingTarget,
      deadline,
      status,
      totalRaised,
      numContributors,
      isSuccessful
    };
  };

  // Create RPC functions
  const createAddContributionRpc = () => {
    return AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("40", "hex"));
    });
  };

  const createEndCampaignRpc = () => {
    return AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("020000000f", "hex"));
    });
  };

  const createWithdrawFundsRpc = () => {
    return AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("030000000f", "hex"));
    });
  };

  // Connect wallet with private key
  const connectWallet = async () => {
    try {
      setLoading(true);
      setStatus('Connecting wallet...');

      // Convert private key to key pair
      const keyPair = ec.keyFromPrivate(privateKey, 'hex');
      
      // Calculate wallet address from public key
      const publicKey = keyPair.getPublic(false, 'array');
      const hash = require('hash.js').sha256().update(publicKey).digest();
      const addressHex = '00' + hash.slice(12).toString('hex');
      
      setWalletAddress(addressHex);

      // Create sender authentication
      const auth: SenderAuthentication = {
        getAddress: () => addressHex,
        sign: async (transactionPayload: Buffer, chainId: string): Promise<string> => {
          // Create hash of transaction payload and chain ID
          const hashInput = Buffer.concat([
            transactionPayload,
            Buffer.from(chainId)
          ]);
          const hash = require('hash.js').sha256().update(hashInput).digest();
          
          // Sign the hash
          const signature = keyPair.sign(hash);
          
          // Serialize signature with recovery param
          const r = signature.r.toArrayLike(Buffer, 'be', 32);
          const s = signature.s.toArrayLike(Buffer, 'be', 32);
          const recovery = Buffer.from([signature.recoveryParam]);
          
          return Buffer.concat([recovery, r, s]).toString('hex');
        }
      };
      
      setSenderAuth(auth);
      
      // Create transaction client
      const txClient = BlockchainTransactionClient.create(TESTNET_URL, auth);
      setTransactionClient(txClient);
      
      // Create ZK client if contract address is set
      if (contractAddress) {
        const zkClientInstance = RealZkClient.create(contractAddress, new Client(TESTNET_URL));
        setZkClient(zkClientInstance);
      }
      
      setStatus(`Wallet connected: ${addressHex}`);
    } catch (error) {
      setStatus(`Connection error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Transaction monitoring
  const waitForTransaction = async (txId: string, shard?: string): Promise<boolean> => {
    const client = new Client(TESTNET_URL);
    const maxAttempts = 30;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const tx = await client.getTransaction(txId);
        if (tx?.finalized) {
          return tx.executionSucceeded;
        }
      } catch (error) {
        console.log(`Waiting for transaction ${txId}...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
    
    throw new Error('Transaction timeout');
  };

  // Fetch contract state
  const fetchContractState = async () => {
    if (!contractAddress) return;
    
    try {
      setLoading(true);
      setStatus('Fetching contract state...');
      
      const client = new Client(TESTNET_URL);
      const response = await client.getContractData(contractAddress);
      
      if (response?.serializedContract?.openState?.openState?.data) {
        const stateBuffer = Buffer.from(response.serializedContract.openState.openState.data, 'base64');
        const parsedState = deserializeContractState(stateBuffer);
        setContractState(parsedState);
        setStatus('Contract state loaded successfully');
        
        // Create ZK client for this contract if not exists
        if (senderAuth && !zkClient) {
          const zkClientInstance = RealZkClient.create(contractAddress, client);
          setZkClient(zkClientInstance);
        }
      } else {
        setStatus('No contract state found - please check the address');
        setContractState(null);
      }
    } catch (error) {
      if (error.message.includes('network')) {
        setStatus('Network error - please check your connection');
      } else {
        setStatus(`Error: ${error.message}`);
      }
      setContractState(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle contribution with detailed debugging
const handleContribution = async () => {
  if (!contractAddress || !contributionAmount) {
    setStatus('Please fill all fields');
    return;
  }

  try {
    setLoading(true);
    setStatus('Processing contribution...');
    console.log('Starting contribution process...');

    // Parse contribution amount
    const amount = parseInt(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      setStatus('Please enter a valid amount');
      return;
    }
    console.log(`Contribution amount: ${amount}`);

    // Debug connection state
    console.log('Connection state:');
    console.log(`- Contract address: ${contractAddress}`);
    console.log(`- Wallet connected: ${!!walletAddress}`);
    console.log(`- ZK client initialized: ${!!zkClient}`);
    console.log(`- Transaction client initialized: ${!!transactionClient}`);

    // Ensure wallet is connected
    if (!walletAddress || !transactionClient) {
      setStatus('Please connect your wallet first');
      return;
    }

    // Ensure ZK client is initialized
    if (!zkClient) {
      console.log('Creating ZK client');
      const client = new Client(TESTNET_URL);
      const zkClientInstance = RealZkClient.create(contractAddress, client);
      setZkClient(zkClientInstance);
      
      // Since setState is asynchronous, we'll use the instance directly
      await handleContributionWithZkClient(amount, zkClientInstance);
    } else {
      await handleContributionWithZkClient(amount, zkClient);
    }
  } catch (error) {
    console.error('Contribution error:', error);
    setStatus(`Error: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

// Helper function to handle contribution with ZK client
const handleContributionWithZkClient = async (amount, zkClient) => {
  try {
    console.log('Creating secret input');
    // Create secret input
    const secretInput = AbiBitOutput.serialize((_out) => {
      _out.writeI32(amount);
    });
    console.log('Secret input created successfully');

    // Create public RPC
    console.log('Creating public RPC');
    const publicRpc = createAddContributionRpc();
    console.log('Public RPC created successfully');
    
    // Build ZK input transaction
    console.log('Building ZK input transaction');
    console.log(`- Wallet address: ${walletAddress}`);
    
    const transaction = await zkClient.buildOnChainInputTransaction(
      BlockchainAddress.fromString(walletAddress),
      secretInput,
      publicRpc
    );
    console.log('ZK transaction built successfully');

    // Sign and send transaction
    console.log('Signing and sending transaction');
    const result = await transactionClient.signAndSend(transaction, 100_000);
    console.log(`Transaction sent: ${result.transactionPointer.identifier}`);
    
    setStatus(`Transaction sent: ${result.transactionPointer.identifier}`);
    setContributionAmount('');
    
    // Refresh state after a delay
    setTimeout(() => fetchContractState(), 5000);
  } catch (error) {
    console.error('Error in ZK contribution:', error);
    throw error; // rethrow to be caught by the parent function
  }
};

  // End campaign
  const handleEndCampaign = async () => {
    if (!transactionClient || !contractAddress) {
      setStatus('Please connect wallet first');
      return;
    }

    try {
      setLoading(true);
      setStatus('Ending campaign...');

      const rpc = createEndCampaignRpc();
      const result = await transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 20_000);
      
      setStatus(`Transaction sent: ${result.transactionPointer.identifier}`);
      
      // Wait for transaction confirmation
      const success = await waitForTransaction(result.transactionPointer.identifier);
      
      if (success) {
        setStatus(`Campaign ended! TX: ${result.transactionPointer.identifier}`);
        await fetchContractState();
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Withdraw funds
  const handleWithdrawFunds = async () => {
    if (!transactionClient || !contractAddress) {
      setStatus('Please connect wallet first');
      return;
    }

    try {
      setLoading(true);
      setStatus('Withdrawing funds...');

      const rpc = createWithdrawFundsRpc();
      const result = await transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 20_000);
      
      setStatus(`Transaction sent: ${result.transactionPointer.identifier}`);
      
      // Wait for transaction confirmation
      const success = await waitForTransaction(result.transactionPointer.identifier);
      
      if (success) {
        setStatus(`Funds withdrawn! TX: ${result.transactionPointer.identifier}`);
        await fetchContractState();
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update ZK client when contract address changes
  useEffect(() => {
    if (contractAddress && senderAuth) {
      const zkClientInstance = RealZkClient.create(contractAddress, new Client(TESTNET_URL));
      setZkClient(zkClientInstance);
    }
  }, [contractAddress, senderAuth]);

  // Auto-refresh state during computation
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (contractState?.status === CampaignStatus.Computing) {
      intervalId = setInterval(() => {
        fetchContractState();
      }, 10000); // Check every 10 seconds
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [contractState?.status]);

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Check if user is owner
  const isOwner = contractState && walletAddress && 
    contractState.owner.asString() === walletAddress;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">ZK Crowdfunding Platform</h1>
      
      {/* Status Display */}
      {status && (
        <div className={`mb-6 p-4 rounded-lg ${
          status.includes('Error') ? 'bg-red-100 text-red-700' : 
          status.includes('TX:') ? 'bg-green-100 text-green-700' : 
          'bg-blue-100 text-blue-700'
        }`}>
          {status}
        </div>
      )}

      {/* Contract Address Input */}
      <div className="mb-8">
        <label className="block mb-2 font-semibold">Campaign Contract Address</label>
        <div className="flex gap-4">
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            className="flex-1 p-2 border rounded-lg"
            placeholder="Enter contract address"
          />
          <button 
            onClick={fetchContractState}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
            disabled={loading || !contractAddress}
          >
            Load Campaign
          </button>
        </div>
      </div>

      {/* Wallet Connection */}
      {!senderAuth ? (
        <div className="mb-8">
          <label className="block mb-2 font-semibold">Private Key</label>
          <div className="flex gap-4">
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="flex-1 p-2 border rounded-lg"
              placeholder="Enter private key"
            />
            <button 
              onClick={connectWallet}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
              disabled={loading || !privateKey}
            >
              Connect Wallet
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-8 p-4 bg-green-50 rounded-lg">
          <p className="font-semibold">Connected Wallet</p>
          <p className="font-mono text-sm">{walletAddress}</p>
        </div>
      )}

      {/* Campaign Details */}
      {contractState && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">{contractState.title}</h2>
          <p className="mb-4">{contractState.description}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-semibold flex items-center gap-2">
                {CampaignStatus[contractState.status]}
                {contractState.status === CampaignStatus.Computing && (
                  <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Funding Target</p>
              <p className="font-semibold">{contractState.fundingTarget}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Deadline</p>
              <p className="font-semibold">{formatDate(contractState.deadline)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Contributors</p>
              <p className="font-semibold">{contractState.numContributors ?? 'N/A'}</p>
            </div>
          </div>

          {contractState.status === CampaignStatus.Completed && (
            <div className="mt-4 p-4 bg-white rounded-lg border">
              <p className="text-sm text-gray-600">Total Raised</p>
              <p className="text-2xl font-bold">{contractState.totalRaised}</p>
              <p className={`mt-2 font-semibold ${
                contractState.isSuccessful ? 'text-green-600' : 'text-red-600'
              }`}>
                {contractState.isSuccessful ? 'Campaign Successful!' : 'Campaign Failed'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {senderAuth && contractState && (
        <div className="space-y-6">
          {/* Contribution */}
          {contractState.status === CampaignStatus.Active && (
            <div>
              <label className="block mb-2 font-semibold">Contribution Amount</label>
              <div className="flex gap-4">
                <input
                  type="number"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  className="flex-1 p-2 border rounded-lg"
                  placeholder="Enter amount"
                  min="1"
                />
                <button 
                  onClick={handleContribution}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300"
                  disabled={loading || !contributionAmount}
                >
                  {loading ? 'Processing...' : 'Contribute'}
                </button>
              </div>
            </div>
          )}

          {/* Campaign Controls */}
          <div className="flex gap-4">
            {contractState.status === CampaignStatus.Active && (
              <button 
                onClick={handleEndCampaign}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-orange-300"
                disabled={loading}
              >
                End Campaign
              </button>
            )}
            
            {contractState.status === CampaignStatus.Completed && 
             contractState.isSuccessful && isOwner && (
              <button 
                onClick={handleWithdrawFunds}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-300"
                disabled={loading}
              >
                Withdraw Funds
              </button>
            )}
          </div>
        </div>
      )}

      {/* Privacy Information */}
      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">🔒 Privacy Features</h3>
        <ul className="space-y-2 text-sm">
          <li>• Individual contribution amounts remain private</li>
          <li>• Total raised is only revealed after campaign ends</li>
          <li>• Zero-knowledge proofs ensure correct computation</li>
          <li>• Multi-party computation validates results</li>
        </ul>
      </div>
    </div>
  );
};

export default ZKCrowdfundingApp;