import React, { useState, useEffect } from 'react';

const ZKCrowdfunding = () => {
  // State
  const [privateKey, setPrivateKey] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [view, setView] = useState('connect'); // connect, create, view
  const [campaignAddress, setCampaignAddress] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState(null);
  
  // Campaign creation form
  const [newCampaign, setNewCampaign] = useState({
    title: '',
    description: '',
    target: '',
    deadline: ''
  });
  
  // Show message notification
  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };
  
  // Connect wallet with private key
  const connectWallet = () => {
    if (!privateKey) {
      showMessage('Please enter a private key', 'error');
      return;
    }
    
    setLoading(true);
    
    // In a real app, this would use the Partisia SDK
    setTimeout(() => {
      const truncatedAddress = `0x${privateKey.slice(0, 6)}...${privateKey.slice(-4)}`;
      setWalletAddress(truncatedAddress);
      setWalletConnected(true);
      setView('create');
      setLoading(false);
      showMessage('Wallet connected successfully', 'success');
    }, 1000);
  };
  
  // Disconnect wallet
  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress('');
    setPrivateKey('');
    setView('connect');
  };
  
  // Create new campaign
  const createCampaign = () => {
    if (!walletConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }
    
    if (!newCampaign.title || !newCampaign.description || !newCampaign.target) {
      showMessage('Please fill all required fields', 'error');
      return;
    }
    
    setLoading(true);
    
    // In a real app, this would deploy a contract on Partisia
    setTimeout(() => {
      const campaignAddr = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
      setCampaignAddress(campaignAddr);
      setCampaign({
        address: campaignAddr,
        title: newCampaign.title,
        description: newCampaign.description,
        owner: walletAddress,
        target: parseInt(newCampaign.target),
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Active',
        totalRaised: null,
        contributors: 0,
        isSuccessful: false
      });
      setView('view');
      setLoading(false);
      showMessage('Campaign created successfully!', 'success');
    }, 1500);
  };
  
  // Load existing campaign
  const loadCampaign = () => {
    if (!campaignAddress) {
      showMessage('Please enter a campaign address', 'error');
      return;
    }
    
    setLoading(true);
    
    // In a real app, this would query the contract
    setTimeout(() => {
      setCampaign({
        address: campaignAddress,
        title: 'Community Garden Project',
        description: 'Help us build a sustainable community garden in the downtown area with eco-friendly materials and educational programs.',
        owner: '0x7a3b...c45d',
        target: 5000,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Active',
        totalRaised: null,
        contributors: 8,
        isSuccessful: false
      });
      setView('view');
      setLoading(false);
      showMessage('Campaign loaded successfully!', 'success');
    }, 1000);
  };
  
  // Make a contribution
  const makeContribution = () => {
    if (!walletConnected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }
    
    if (!contributionAmount || isNaN(parseInt(contributionAmount)) || parseInt(contributionAmount) <= 0) {
      showMessage('Please enter a valid contribution amount', 'error');
      return;
    }
    
    setLoading(true);
    
    // In a real app, this would call the contract's ZK function
    setTimeout(() => {
      setCampaign({
        ...campaign,
        contributors: campaign.contributors + 1
      });
      setContributionAmount('');
      setLoading(false);
      showMessage(`Contribution of ${contributionAmount} submitted! Your contribution amount is private.`, 'success');
    }, 1500);
  };
  
  // End campaign and compute results
  const endCampaign = () => {
    setLoading(true);
    
    // In a real app, this would trigger the ZK computation
    setTimeout(() => {
      setCampaign({
        ...campaign,
        status: 'Completed',
        totalRaised: 6250,
        isSuccessful: true
      });
      setLoading(false);
      showMessage('Campaign ended and total funds revealed!', 'success');
    }, 2000);
  };
  
  // Withdraw funds
  const withdrawFunds = () => {
    setLoading(true);
    
    // In a real app, this would call the contract
    setTimeout(() => {
      setLoading(false);
      showMessage('Funds withdrawn successfully!', 'success');
    }, 1500);
  };
  
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">🔒 ZK Crowdfunding</h1>
            {walletConnected && (
              <div className="bg-black text-white text-xs px-3 py-1 rounded-full">
                {walletAddress}
              </div>
            )}
          </div>
          
          {/* Messages */}
          {message.text && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border-l-4 border-green-500' : 
              message.type === 'error' ? 'bg-red-50 text-red-700 border-l-4 border-red-500' : 
              'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
            }`}>
              {message.text}
            </div>
          )}
          
          {/* Wallet Connection View */}
          {view === 'connect' && (
            <div>
              <p className="text-gray-600 mb-4">Connect your wallet to create or contribute to privacy-preserving crowdfunding campaigns.</p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Private Key
                </label>
                <input
                  type="password"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Enter your private key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500">For demo only. Never share your actual private key.</p>
              </div>
              
              <button
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                onClick={connectWallet}
                disabled={loading || !privateKey}
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            </div>
          )}
          
          {/* Create Campaign View */}
          {view === 'create' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Create Campaign</h2>
                <button 
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={disconnectWallet}
                >
                  Disconnect
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Campaign title"
                  value={newCampaign.title}
                  onChange={(e) => setNewCampaign({...newCampaign, title: e.target.value})}
                  disabled={loading}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Describe your campaign"
                  rows={3}
                  value={newCampaign.description}
                  onChange={(e) => setNewCampaign({...newCampaign, description: e.target.value})}
                  disabled={loading}
                ></textarea>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Funding Target
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Amount to raise"
                  value={newCampaign.target}
                  onChange={(e) => setNewCampaign({...newCampaign, target: e.target.value})}
                  disabled={loading}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  onClick={createCampaign}
                  disabled={loading || !newCampaign.title || !newCampaign.description || !newCampaign.target}
                >
                  {loading ? 'Creating...' : 'Create Campaign'}
                </button>
                
                <button
                  className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  onClick={() => setView('load')}
                  disabled={loading}
                >
                  Load Existing
                </button>
              </div>
            </div>
          )}
          
          {/* Load Campaign View */}
          {view === 'load' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Load Campaign</h2>
                <button 
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={() => setView('create')}
                >
                  Back
                </button>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Address
                </label>
                <input
                  type="text"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Enter campaign address"
                  value={campaignAddress}
                  onChange={(e) => setCampaignAddress(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <button
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                onClick={loadCampaign}
                disabled={loading || !campaignAddress}
              >
                {loading ? 'Loading...' : 'Load Campaign'}
              </button>
            </div>
          )}
          
          {/* View Campaign */}
          {view === 'view' && campaign && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Campaign Details</h2>
                <button 
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={() => setView('create')}
                >
                  Back
                </button>
              </div>
              
              <div className="bg-gray-50 rounded-md p-4 mb-4">
                <h3 className="text-xl font-medium text-gray-800 mb-1">{campaign.title}</h3>
                <p className="text-sm text-gray-500 mb-3">by {campaign.owner}</p>
                <p className="text-gray-700 mb-4">{campaign.description}</p>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <p className={`font-medium ${campaign.status === 'Active' ? 'text-green-600' : 'text-blue-600'}`}>
                      {campaign.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Target</p>
                    <p className="font-medium text-gray-800">{campaign.target}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Deadline</p>
                    <p className="font-medium text-gray-800">{campaign.deadline}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Contributors</p>
                    <p className="font-medium text-gray-800">{campaign.contributors}</p>
                  </div>
                </div>
                
                {campaign.status === 'Completed' && (
                  <div className={`mt-3 p-2 rounded-md text-sm ${campaign.isSuccessful ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {campaign.isSuccessful 
                      ? `Campaign Successful! Raised ${campaign.totalRaised} of ${campaign.target} target.` 
                      : `Campaign Unsuccessful. Only raised ${campaign.totalRaised} of ${campaign.target} needed.`}
                  </div>
                )}
              </div>
              
              {/* Campaign actions */}
              <div className="space-y-4">
                {campaign.status === 'Active' && (
                  <div className="bg-indigo-50 rounded-md p-4">
                    <h4 className="font-medium text-indigo-800 mb-2">Make a Contribution</h4>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        className="flex-1 p-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Enter amount"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        disabled={loading}
                      />
                      <button
                        className="bg-indigo-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        onClick={makeContribution}
                        disabled={loading || !contributionAmount}
                      >
                        {loading ? '...' : 'Contribute'}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-indigo-700">Your contribution amount will remain private until the campaign ends.</p>
                  </div>
                )}
                
                {campaign.status === 'Active' && campaign.owner === walletAddress && (
                  <button
                    className="w-full bg-yellow-500 text-white py-2 px-4 rounded-md font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50"
                    onClick={endCampaign}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'End Campaign & Compute Results'}
                  </button>
                )}
                
                {campaign.status === 'Completed' && campaign.isSuccessful && campaign.owner === walletAddress && (
                  <button
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    onClick={withdrawFunds}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Withdraw Funds'}
                  </button>
                )}
              </div>
              
              {/* Privacy information */}
              <div className="mt-6 text-xs text-gray-500 bg-gray-50 p-3 rounded-md">
                <p className="font-medium text-gray-700 mb-1">🔒 Privacy Features</p>
                <ul className="space-y-1">
                  <li>• Individual contribution amounts remain private</li>
                  <li>• Total raised amount is only revealed after campaign ends</li>
                  <li>• Powered by Partisia Blockchain's secure MPC technology</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ZKCrowdfunding;