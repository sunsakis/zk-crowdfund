import React, { useState, useEffect } from 'react';
import { useBlockchain } from './hooks/useBlockchain';
import config from './config';

function App() {
  // Campaign contract address (selected/current campaign)
  const [campaignAddressInput, setCampaignAddressInput] = useState<string>('');
  const [currentCampaignAddress, setCurrentCampaignAddress] = useState<string>(config.defaultCampaignAddress || '');
  
  // Factory contract address (central contract for the entire dApp)
  const [factoryAddress, setFactoryAddress] = useState<string>(config.factoryAddress);
  
  // Contribution state
  const [contributionAmount, setContributionAmount] = useState<string>('');
  
  // UI state
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  
  // Campaign creation form state
  const [campaignTitle, setCampaignTitle] = useState<string>('');
  const [campaignDescription, setCampaignDescription] = useState<string>('');
  const [campaignCategory, setCampaignCategory] = useState<string>('');
  const [campaignImageUrl, setCampaignImageUrl] = useState<string>('');
  const [campaignTarget, setCampaignTarget] = useState<string>('');
  const [campaignDeadline, setCampaignDeadline] = useState<string>('');
  
  // Campaign list state
  const [myCampaigns, setMyCampaigns] = useState<any[]>([]);
  
  // Use the blockchain hook
  const {
    project,
    wallet,
    isOwner,
    loading,
    error,
    connectWallet,
    disconnectWallet,
    refreshProject,
    contribute,
    endCampaign,
    withdrawFunds,
    createCampaign,
    getMyCampaigns
  } = useBlockchain({
    contractAddress: currentCampaignAddress,
    factoryAddress,
    refreshInterval: 10000
  });
  
  // Initialize from config
  useEffect(() => {
    if (config.factoryAddress) {
      setFactoryAddress(config.factoryAddress);
    }
    if (config.defaultCampaignAddress) {
      setCampaignAddressInput(config.defaultCampaignAddress);
      setCurrentCampaignAddress(config.defaultCampaignAddress);
    }
  }, []);
  
  // Load user's campaigns when wallet connects
  useEffect(() => {
    if (wallet && factoryAddress) {
      loadMyCampaigns();
    }
  }, [wallet, factoryAddress]);
  
  // Show error messages from the hook
  useEffect(() => {
    if (error) {
      setMessage(error);
      setMessageType('error');
    }
  }, [error]);
  
  // Load user's campaigns from factory
  const loadMyCampaigns = async () => {
    try {
      const campaigns = await getMyCampaigns();
      setMyCampaigns(campaigns);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };
  
  // Format timestamp to readable date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Calculate time left until deadline
  const getTimeLeft = (deadline: number): string => {
    const now = Date.now();
    if (now >= deadline) return "Deadline passed";
    
    const diff = deadline - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${days}d ${hours}h ${minutes}m`;
  };
  
  // Handle setting the campaign address
  const handleSetCampaignAddress = () => {
    if (!campaignAddressInput) {
      setMessage('Please enter a campaign contract address');
      setMessageType('error');
      return;
    }
    
    setCurrentCampaignAddress(campaignAddressInput);
    setMessage('Loading campaign data...');
    setMessageType('info');
  };
  
  // Handle campaign creation (will immediately create in Active state)
  const handleCreateCampaign = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
      setMessageType('error');
      return;
    }
    
    if (!factoryAddress) {
      setMessage('Factory contract address not configured');
      setMessageType('error');
      return;
    }
    
    // Validate inputs
    if (!campaignTitle || !campaignDescription || !campaignCategory || !campaignTarget || !campaignDeadline) {
      setMessage('Please fill in all required fields');
      setMessageType('error');
      return;
    }
    
    const target = parseInt(campaignTarget);
    if (isNaN(target) || target <= 0) {
      setMessage('Please enter a valid target amount');
      setMessageType('error');
      return;
    }
    
    const deadlineTimestamp = new Date(campaignDeadline).getTime();
    if (deadlineTimestamp <= Date.now()) {
      setMessage('Deadline must be in the future');
      setMessageType('error');
      return;
    }
    
    setMessage('Creating campaign...');
    setMessageType('info');
    
    try {
      const result = await createCampaign({
        title: campaignTitle,
        description: campaignDescription,
        category: campaignCategory,
        image_url: campaignImageUrl || '',
        funding_target: target,
        deadline: deadlineTimestamp
      });
      
      if (result.success) {
        setMessage(`Campaign created successfully and is now active! Transaction ID: ${result.txId}`);
        setMessageType('success');
        
        // Clear form
        setCampaignTitle('');
        setCampaignDescription('');
        setCampaignCategory('');
        setCampaignImageUrl('');
        setCampaignTarget('');
        setCampaignDeadline('');
        setShowCreateForm(false);
        
        // Reload campaigns
        await loadMyCampaigns();
      } else {
        setMessage(`Failed to create campaign: ${result.error}`);
        setMessageType('error');
      }
    } catch (error) {
      setMessage(`Error creating campaign: ${error instanceof Error ? error.message : String(error)}`);
      setMessageType('error');
    }
  };
  
  // Handle wallet connection
  const handleConnectWallet = async () => {
    if (!privateKey) {
      setMessage('Please enter a private key');
      setMessageType('error');
      return;
    }
    
    setMessage('Connecting to wallet...');
    setMessageType('info');
    
    try {
      const connectedWallet = await connectWallet(privateKey);
      if (connectedWallet) {
        setMessage(`Connected to wallet: ${connectedWallet.address.substring(0, 8)}...`);
        setMessageType('success');
        setPrivateKey('');
      }
    } catch (error) {
      setMessage(`Failed to connect wallet: ${error instanceof Error ? error.message : String(error)}`);
      setMessageType('error');
    }
  };
  
  // Handle selecting a campaign from the list
  const handleSelectCampaign = (campaignAddress: string) => {
    setCurrentCampaignAddress(campaignAddress);
    setCampaignAddressInput(campaignAddress);
    setMessage(`Selected campaign: ${campaignAddress}`);
    setMessageType('info');
  };
  
  // Handle contribution submission
  const handleContribute = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
      setMessageType('error');
      return;
    }
    
    if (!currentCampaignAddress) {
      setMessage('Please select a campaign first');
      setMessageType('error');
      return;
    }
    
    if (!contributionAmount) {
      setMessage('Please enter a contribution amount');
      setMessageType('error');
      return;
    }
    
    const amount = parseInt(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage('Please enter a valid positive amount');
      setMessageType('error');
      return;
    }
    
    setMessage('Submitting contribution...');
    setMessageType('info');
    
    const result = await contribute(amount);
    
    if (result.success) {
      setMessage(`Contribution of ${amount} submitted successfully! ${result.txId ? `Transaction ID: ${result.txId}` : ''}`);
      setMessageType('success');
      setContributionAmount('');
    } else {
      setMessage(`Contribution failed: ${result.error}`);
      setMessageType('error');
    }
  };
  
  // Campaign management handlers (removed start campaign handler)
  const handleEndCampaign = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
      setMessageType('error');
      return;
    }
    
    if (!currentCampaignAddress) {
      setMessage('Please select a campaign first');
      setMessageType('error');
      return;
    }
    
    setMessage('Ending campaign and starting computation...');
    setMessageType('info');
    
    const result = await endCampaign();
    
    if (result.success) {
      setMessage(`Campaign end request submitted successfully. Computation in progress... ${result.txId ? `Transaction ID: ${result.txId}` : ''}`);
      setMessageType('success');
    } else {
      setMessage(`Failed to end campaign: ${result.error}`);
      setMessageType('error');
    }
  };
  
  const handleWithdrawFunds = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
      setMessageType('error');
      return;
    }
    
    if (!currentCampaignAddress) {
      setMessage('Please select a campaign first');
      setMessageType('error');
      return;
    }
    
    if (!isOwner) {
      setMessage('Only the project owner can withdraw funds');
      setMessageType('error');
      return;
    }
    
    setMessage('Withdrawing funds...');
    setMessageType('info');
    
    const result = await withdrawFunds();
    
    if (result.success) {
      setMessage(`Funds withdrawal request submitted successfully. ${result.txId ? `Transaction ID: ${result.txId}` : ''}`);
      setMessageType('success');
    } else {
      setMessage(`Failed to withdraw funds: ${result.error}`);
      setMessageType('error');
    }
  };
  
  // Check if deadline is passed
  const isDeadlinePassed = project ? Date.now() > project.deadline : false;
  
  return (
    <div className="max-w-4xl mx-auto p-4">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 text-blue-600">ZK Crowdfunding Platform</h1>
        <p className="text-gray-600">Create and support projects with privacy-preserving crowdfunding</p>
      </header>

      <main>
        {/* Factory Contract Section */}
        <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Campaign Factory Contract</h2>
          <p className="text-gray-700 mb-4">
            This platform uses Partisia Blockchain's Multi-Party Computation (MPC) technology to keep individual
            contributions private while ensuring transparency in the overall funding process.
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li><strong>Create Your Own Campaign:</strong> Launch privacy-preserving crowdfunding campaigns that start immediately in Active state.</li>
            <li><strong>Confidential Contributions:</strong> Individual contribution amounts remain private throughout the entire process.</li>
            <li><strong>Threshold-Based Reveal:</strong> The total raised amount is only revealed after the campaign ends.</li>
            <li><strong>Fair Verification:</strong> MPC ensures that the computation is done correctly without exposing sensitive data.</li>
          </ul>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold mb-2">How it works:</h4>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Create a new campaign through the factory contract (starts Active immediately)</li>
              <li>Contributors can make private contributions to the campaign</li>
              <li>When the campaign ends, MPC computes the total raised amount</li>
              <li>If successful, the owner can withdraw funds</li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App