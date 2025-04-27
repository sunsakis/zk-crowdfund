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
    startCampaign,
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
  
  // Handle campaign creation
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
        setMessage(`Campaign created successfully! Transaction ID: ${result.txId}`);
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
  
  // Campaign management handlers
  const handleStartCampaign = async () => {
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
      setMessage('Only the project owner can start the campaign');
      setMessageType('error');
      return;
    }
    
    setMessage('Starting campaign...');
    setMessageType('info');
    
    const result = await startCampaign();
    
    if (result.success) {
      setMessage(`Campaign started successfully! ${result.txId ? `Transaction ID: ${result.txId}` : ''}`);
      setMessageType('success');
    } else {
      setMessage(`Failed to start campaign: ${result.error}`);
      setMessageType('error');
    }
  };
  
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
          <p className="text-sm text-gray-600 mb-4">
            This is the main contract for the entire dApp that creates and manages crowdfunding campaigns.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter factory contract address"
              value={factoryAddress}
              onChange={(e) => setFactoryAddress(e.target.value)}
              disabled={!!config.factoryAddress} // Disable if set in config
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            />
          </div>
          {factoryAddress && (
            <p className="mt-2 text-xs text-gray-500">
              Factory address: {factoryAddress}
            </p>
          )}
        </section>

        {/* Wallet Connection Section */}
        <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Wallet Connection</h2>
          {!wallet ? (
            <div>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter private key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button 
                  onClick={handleConnectWallet} 
                  disabled={loading || !privateKey}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Use the private key for Account-A.pk, Account-B.pk, or Account-C.pk
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-2">Connected: {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}</p>
              <button 
                onClick={disconnectWallet}
                className="px-4 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Disconnect
              </button>
            </div>
          )}
        </section>

        {/* Campaign Creation Section */}
        {wallet && factoryAddress && (
          <section className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create New Campaign</h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {showCreateForm ? 'Hide Form' : 'Create Campaign'}
              </button>
            </div>
            
            {showCreateForm && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter campaign title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={campaignDescription}
                    onChange={(e) => setCampaignDescription(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter campaign description"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={campaignCategory}
                    onChange={(e) => setCampaignCategory(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Technology, Health, Education"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                  <input
                    type="text"
                    value={campaignImageUrl}
                    onChange={(e) => setCampaignImageUrl(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter image URL (optional)"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Funding Target</label>
                    <input
                      type="number"
                      value={campaignTarget}
                      onChange={(e) => setCampaignTarget(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter target amount"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                    <input
                      type="datetime-local"
                      value={campaignDeadline}
                      onChange={(e) => setCampaignDeadline(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <button
                  onClick={handleCreateCampaign}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {loading ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            )}
          </section>
        )}

        {/* My Campaigns Section */}
        {wallet && myCampaigns.length > 0 && (
          <section className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">My Campaigns</h2>
            <div className="space-y-4">
              {myCampaigns.map((campaign) => (
                <div 
                  key={campaign.address} 
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelectCampaign(campaign.address)}
                >
                  <h3 className="font-semibold text-lg">{campaign.title}</h3>
                  <p className="text-gray-600 text-sm">{campaign.description}</p>
                  <div className="mt-2 flex justify-between text-sm text-gray-500">
                    <span>Target: {campaign.target}</span>
                    <span>Deadline: {formatDate(campaign.deadline)}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Campaign Address: {campaign.address}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Campaign Selection Section */}
        <section className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">View Individual Campaign</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter the address of a specific crowdfunding campaign to view details and interact with it.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Enter campaign contract address"
              value={campaignAddressInput}
              onChange={(e) => setCampaignAddressInput(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button 
              onClick={handleSetCampaignAddress} 
              disabled={loading || !campaignAddressInput}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'View Campaign'}
            </button>
          </div>
          {currentCampaignAddress && (
            <p className="text-xs text-gray-500">
              Currently viewing campaign: {currentCampaignAddress}
            </p>
          )}
        </section>

        {/* Project Details Section */}
        {project && currentCampaignAddress && (
          <section className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="text-xs text-gray-500 mb-2">
              Campaign Contract: {currentCampaignAddress}
            </div>
            <h2 className="text-2xl font-bold mb-2">{project.title}</h2>
            <p className="text-gray-600 mb-6">{project.description}</p>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium inline-block
                    ${project.status === 'Setup' ? 'bg-gray-200 text-gray-800' : ''}
                    ${project.status === 'Active' ? 'bg-blue-100 text-blue-800' : ''}
                    ${project.status === 'Computing' ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${project.status === 'Completed' ? 'bg-green-100 text-green-800' : ''}`}>
                    {project.status}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-600">Funding Target:</span>
                  <span className="ml-2 font-semibold">{project.fundingTarget}</span>
                </div>
              </div>
              
              <div className="mt-4">
                <span className="text-gray-600">Deadline:</span>
                <span className="ml-2">{formatDate(project.deadline)} ({isDeadlinePassed ? 'Expired' : getTimeLeft(project.deadline)})</span>
              </div>
              
              {project.numContributors !== null && (
                <div className="mt-4">
                  <span className="text-gray-600">Contributors:</span>
                  <span className="ml-2 font-semibold">{project.numContributors}</span>
                </div>
              )}
              
              {project.totalRaised !== null && (
                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <span className="text-gray-600">Total Raised:</span>
                  <span className="ml-2 font-semibold text-lg">{project.totalRaised}</span>
                </div>
              )}
              
              {project.isSuccessful !== null && (
                <div className={`mt-4 p-3 rounded border ${project.isSuccessful ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <span className="text-gray-600">Campaign Result:</span>
                  <span className={`ml-2 font-bold ${project.isSuccessful ? 'text-green-700' : 'text-red-700'}`}>
                    {project.isSuccessful ? 'Successful' : 'Failed'}
                  </span>
                </div>
              )}
            </div>

            {/* Action Sections based on status */}
            {wallet && (
              <div className="mt-6 space-y-6">
                {/* Setup State - Start Campaign */}
                {project.status === 'Setup' && isOwner && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-semibold mb-2">Start Campaign</h3>
                    <p className="text-gray-600 mb-4">
                      Once the campaign is started, contributors will be able to make private contributions.
                    </p>
                    <button 
                      onClick={handleStartCampaign} 
                      disabled={loading}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {loading ? 'Processing...' : 'Start Campaign'}
                    </button>
                  </div>
                )}

                {/* Active State - Contribute */}
                {project.status === 'Active' && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-semibold mb-2">Make a Private Contribution</h3>
                    <p className="text-gray-600 mb-4">
                      Your contribution amount will remain confidential throughout the campaign.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Enter amount"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button 
                        onClick={handleContribute} 
                        disabled={loading || !contributionAmount}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {loading ? 'Processing...' : 'Contribute'}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 italic">
                      Only the total amount raised will be revealed if the funding target is reached.
                    </p>
                  </div>
                )}

                {/* Active State - End Campaign */}
                {project.status === 'Active' && (isOwner || isDeadlinePassed) && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-semibold mb-2">End Campaign & Compute Results</h3>
                    <p className="text-gray-600 mb-4">
                      This will close the campaign and trigger MPC to securely compute the total raised amount.
                    </p>
                    <button 
                      onClick={handleEndCampaign} 
                      disabled={loading}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {loading ? 'Processing...' : 'End Campaign'}
                    </button>
                    <p className="mt-2 text-sm text-gray-500">
                      {isOwner 
                        ? "As the owner, you can end the campaign at any time" 
                        : "Anyone can end the campaign after the deadline has passed"}
                    </p>
                  </div>
                )}

                {/* Computing State */}
                {project.status === 'Computing' && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 className="font-semibold mb-2">Computation in Progress</h3>
                    <div className="flex justify-center my-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
                    </div>
                    <p className="text-gray-600 text-center">
                      The Multi-Party Computation to securely tally all contributions is in progress.
                      The page will automatically refresh when complete.
                    </p>
                  </div>
                )}

                {/* Completed State - Withdraw Funds */}
                {project.status === 'Completed' && project.isSuccessful && isOwner && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="font-semibold mb-2">Withdraw Funds</h3>
                    <p className="text-gray-600 mb-4">
                      As the project owner, you can now withdraw the raised funds.
                    </p>
                    <button 
                      onClick={handleWithdrawFunds} 
                      disabled={loading}
                      className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {loading ? 'Processing...' : 'Withdraw Funds'}
                    </button>
                  </div>
                )}

                {/* Completed State - Results */}
                {project.status === 'Completed' && (
                  <div className={`p-4 rounded-lg border ${project.isSuccessful ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-semibold mb-2">Campaign Results</h3>
                    <p>
                      {project.isSuccessful 
                        ? `Successfully raised ${project.totalRaised} (target: ${project.fundingTarget})` 
                        : `Did not meet the target (raised ${project.totalRaised} of ${project.fundingTarget})`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Message Section */}
        {message && (
          <div className={`p-4 rounded-lg mt-6 ${
            messageType === 'success' ? 'bg-green-100 border-l-4 border-green-500 text-green-700' :
            messageType === 'error' ? 'bg-red-100 border-l-4 border-red-500 text-red-700' :
            'bg-blue-100 border-l-4 border-blue-500 text-blue-700'
          }`}>
            <p>{message}</p>
          </div>
        )}

        {/* Privacy Information */}
        <section className="bg-gray-50 p-6 rounded-lg mt-6">
          <h3 className="text-lg font-semibold mb-2">About Zero-Knowledge Crowdfunding</h3>
          <p className="text-gray-700 mb-4">
            This platform uses Partisia Blockchain's Multi-Party Computation (MPC) technology to keep individual
            contributions private while ensuring transparency in the overall funding process.
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li><strong>Create Your Own Campaign:</strong> Launch privacy-preserving crowdfunding campaigns for your projects using the factory contract.</li>
            <li><strong>Confidential Contributions:</strong> Individual contribution amounts remain private throughout the entire process.</li>
            <li><strong>Threshold-Based Reveal:</strong> The total raised amount is only revealed after the campaign ends.</li>
            <li><strong>Fair Verification:</strong> MPC ensures that the computation is done correctly without exposing sensitive data.</li>
          </ul>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold mb-2">How it works:</h4>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Create a new campaign through the factory contract</li>
              <li>The factory creates a new individual campaign contract</li>
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

export default App;