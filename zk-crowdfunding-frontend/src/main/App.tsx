import React, { useState, useEffect } from 'react';
import { useBlockchain } from './hooks/useBlockchain';

interface Config {
  factoryAddress: string;
  defaultCampaignAddress?: string;
}

const config: Config = {
  factoryAddress: process.env.REACT_APP_FACTORY_ADDRESS || '0288d02df00d84c5f582eff9eb5c0ac34869c2be3c',
  defaultCampaignAddress: process.env.REACT_APP_DEFAULT_CAMPAIGN_ADDRESS
};

function App() {
  const [campaignAddress, setCampaignAddress] = useState<string>(config.defaultCampaignAddress || '');
  const [contributionAmount, setContributionAmount] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  
  // Campaign creation form state
  const [campaignTitle, setCampaignTitle] = useState<string>('');
  const [campaignDescription, setCampaignDescription] = useState<string>('');
  const [campaignTarget, setCampaignTarget] = useState<string>('');
  const [campaignDeadline, setCampaignDeadline] = useState<string>('');
  
  const {
    project,
    wallet,
    isOwner,
    loading,
    error,
    connectWallet,
    disconnectWallet,
    contribute,
    endCampaign,
    withdrawFunds,
    createCampaign,
    getMyCampaigns
  } = useBlockchain({
    contractAddress: campaignAddress,
    factoryAddress: config.factoryAddress,
    refreshInterval: 10000
  });

  const [myCampaigns, setMyCampaigns] = useState<any[]>([]);
  
  useEffect(() => {
    if (wallet) {
      loadMyCampaigns();
    }
  }, [wallet]);
  
  useEffect(() => {
    if (error) {
      setMessage(error);
      setMessageType('error');
    }
  }, [error]);
  
  const loadMyCampaigns = async () => {
    try {
      const campaigns = await getMyCampaigns();
      setMyCampaigns(campaigns);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    }
  };
  
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };
  
  const handleCreateCampaign = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
      setMessageType('error');
      return;
    }
    
    if (!campaignTitle || !campaignDescription || !campaignTarget || !campaignDeadline) {
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
    
    try {
      const result = await createCampaign({
        title: campaignTitle,
        description: campaignDescription,
        category: "General",
        funding_target: target,
        deadline: deadlineTimestamp
      });
      
      if (result.success) {
        setMessage(`Campaign created successfully! TX: ${result.txId}`);
        setMessageType('success');
        setShowCreateForm(false);
        await loadMyCampaigns();
      } else {
        setMessage(`Failed: ${result.error}`);
        setMessageType('error');
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setMessageType('error');
    }
  };
  
  const handleConnectWallet = async () => {
    if (!privateKey) {
      setMessage('Please enter a private key');
      setMessageType('error');
      return;
    }
    
    try {
      const connectedWallet = await connectWallet(privateKey);
      if (connectedWallet) {
        setMessage(`Connected: ${connectedWallet.address}`);
        setMessageType('success');
        setPrivateKey('');
      }
    } catch (error) {
      setMessage(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
      setMessageType('error');
    }
  };
  
  const handleContribute = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
      setMessageType('error');
      return;
    }
    
    if (!campaignAddress) {
      setMessage('Please select a campaign first');
      setMessageType('error');
      return;
    }
    
    const amount = parseInt(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage('Please enter a valid amount');
      setMessageType('error');
      return;
    }
    
    const result = await contribute(amount);
    
    if (result.success) {
      setMessage(`Contribution submitted! TX: ${result.txId}`);
      setMessageType('success');
      setContributionAmount('');
    } else {
      setMessage(`Failed: ${result.error}`);
      setMessageType('error');
    }
  };
  
  const handleEndCampaign = async () => {
    const result = await endCampaign();
    
    if (result.success) {
      setMessage(`Campaign ended! TX: ${result.txId}`);
      setMessageType('success');
    } else {
      setMessage(`Failed: ${result.error}`);
      setMessageType('error');
    }
  };
  
  const handleWithdrawFunds = async () => {
    const result = await withdrawFunds();
    
    if (result.success) {
      setMessage(`Funds withdrawn! TX: ${result.txId}`);
      setMessageType('success');
    } else {
      setMessage(`Failed: ${result.error}`);
      setMessageType('error');
    }
  };
  
  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ZK Crowdfunding</h1>
      
      {/* Message Display */}
      {message && (
        <div className={`p-3 mb-4 rounded ${
          messageType === 'success' ? 'bg-green-100 text-green-700' :
          messageType === 'error' ? 'bg-red-100 text-red-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {message}
        </div>
      )}
      
      {/* Wallet Connection */}
      {!wallet ? (
        <div className="mb-4">
          <input
            type="password"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Enter private key"
            className="border p-2 rounded mr-2"
          />
          <button
            onClick={handleConnectWallet}
            className="bg-blue-500 text-white p-2 rounded"
          >
            Connect
          </button>
        </div>
      ) : (
        <div className="mb-4">
          <span>Connected: {wallet.address}</span>
          <button
            onClick={disconnectWallet}
            className="bg-red-500 text-white p-2 rounded ml-2"
          >
            Disconnect
          </button>
        </div>
      )}
      
      {/* Create Campaign Button */}
      {wallet && (
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-green-500 text-white p-2 rounded mb-4"
        >
          {showCreateForm ? 'Cancel' : 'Create Campaign'}
        </button>
      )}
      
      {/* Create Campaign Form */}
      {showCreateForm && (
        <div className="bg-gray-100 p-4 rounded mb-4">
          <h2 className="text-xl font-bold mb-2">Create Campaign</h2>
          <input
            value={campaignTitle}
            onChange={(e) => setCampaignTitle(e.target.value)}
            placeholder="Title"
            className="border p-2 rounded w-full mb-2"
          />
          <textarea
            value={campaignDescription}
            onChange={(e) => setCampaignDescription(e.target.value)}
            placeholder="Description"
            className="border p-2 rounded w-full mb-2"
          />
          <input
            type="number"
            value={campaignTarget}
            onChange={(e) => setCampaignTarget(e.target.value)}
            placeholder="Funding Target"
            className="border p-2 rounded w-full mb-2"
          />
          <input
            type="datetime-local"
            value={campaignDeadline}
            onChange={(e) => setCampaignDeadline(e.target.value)}
            className="border p-2 rounded w-full mb-2"
          />
          <button
            onClick={handleCreateCampaign}
            className="bg-blue-500 text-white p-2 rounded w-full"
          >
            Create Campaign
          </button>
        </div>
      )}
      
      {/* Campaign Selection */}
      <div className="mb-4">
        <input
          value={campaignAddress}
          onChange={(e) => setCampaignAddress(e.target.value)}
          placeholder="Campaign Address"
          className="border p-2 rounded w-full"
        />
      </div>
      
      {/* My Campaigns List */}
      {myCampaigns.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl font-bold mb-2">My Campaigns</h2>
          {myCampaigns.map((campaign, i) => (
            <div
              key={i}
              onClick={() => setCampaignAddress(campaign.address)}
              className="bg-gray-100 p-2 rounded mb-2 cursor-pointer hover:bg-gray-200"
            >
              <div className="font-bold">{campaign.title}</div>
              <div className="text-sm text-gray-600">{campaign.address}</div>
            </div>
          ))}
        </div>
      )}
      
      {/* Project Details */}
      {project && (
        <div className="mb-4 bg-gray-100 p-4 rounded">
          <h2 className="text-xl font-bold mb-2">{project.title}</h2>
          <p>{project.description}</p>
          <p>Target: {project.fundingTarget}</p>
          <p>Deadline: {formatDate(project.deadline)}</p>
          <p>Status: {project.status}</p>
          <p>Contributors: {project.numContributors || 0}</p>
          {project.totalRaised !== null && (
            <p>Total Raised: {project.totalRaised}</p>
          )}
        </div>
      )}
      
      {/* Actions */}
      {project && wallet && (
        <div className="space-y-4">
          {/* Contribute */}
          {project.status === 'Active' && (
            <div>
              <input
                type="number"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                placeholder="Amount"
                className="border p-2 rounded mr-2"
              />
              <button
                onClick={handleContribute}
                className="bg-blue-500 text-white p-2 rounded"
              >
                Contribute
              </button>
            </div>
          )}
          
          {/* End Campaign */}
          {project.status === 'Active' && (
            <button
              onClick={handleEndCampaign}
              className="bg-yellow-500 text-white p-2 rounded"
            >
              End Campaign
            </button>
          )}
          
          {/* Withdraw Funds */}
          {project.status === 'Completed' && project.isSuccessful && isOwner && (
            <button
              onClick={handleWithdrawFunds}
              className="bg-green-500 text-white p-2 rounded"
            >
              Withdraw Funds
            </button>
          )}
        </div>
      )}
      
      {loading && <div className="mt-4">Loading...</div>}
    </div>
  );
}

export default App;