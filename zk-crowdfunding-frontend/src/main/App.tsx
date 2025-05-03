import React, { useState, useEffect, useCallback } from 'react';
import { CrowdfundingClient, CampaignStatus, CampaignData } from './client/CrowdfundingClient';

const client = new CrowdfundingClient();

const ZKCrowdfundingApp = () => {
  const [contractAddress, setContractAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [campaignData, setCampaignData] = useState<CampaignData | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [txHash, setTxHash] = useState('');

  // Show a message with type (success, error, info)
  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage({ text, type });
    // Clear message after 10 seconds
    setTimeout(() => setMessage({ text: '', type: '' }), 10000);
  };

  // Format date from unix timestamp
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get status name from enum
  const getStatusName = (status: CampaignStatus) => {
    switch (status) {
      case CampaignStatus.Active: return "Active";
      case CampaignStatus.Computing: return "Computing";
      case CampaignStatus.Completed: return "Completed";
      default: return "Unknown";
    }
  };

  // Create transaction URL for explorer
  const getTransactionUrl = (txId: string) => {
    return `https://browser.testnet.partisiablockchain.com/transactions/${txId}`;
  };

  // Check if campaign is active
  const isCampaignActive = campaignData?.status === CampaignStatus.Active;
  
  // Check if campaign is completed and successful
  const canWithdraw = campaignData?.status === CampaignStatus.Completed 
                      && campaignData?.isSuccessful === true
                      && isOwner;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ZK Crowdfunding App</h1>
      
      {/* Message display */}
      {message.text && (
        <div className={`p-4 mb-6 rounded border-l-4 ${
          message.type === 'success' ? 'bg-green-50 border-green-500 text-green-700' : 
          message.type === 'error' ? 'bg-red-50 border-red-500 text-red-700' : 
          'bg-blue-50 border-blue-500 text-blue-700'
        }`}>
          {message.text}
        </div>
      )}
      
      {/* Contract Address Input */}
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Campaign Contract Address</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="Enter contract address"
            disabled={loading}
          />
          <button 
            onClick={loadCampaign}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            disabled={loading || !contractAddress}
          >
            {loading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </div>
      
      {/* Wallet Connection */}
      {!walletConnected ? (
        <div className="mb-6">
          <label className="block mb-2 font-semibold">Connect Wallet</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              className="flex-1 p-2 border rounded"
              placeholder="Enter private key"
              disabled={loading}
            />
            <button 
              onClick={connectWallet}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
              disabled={loading || !privateKey}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
          <p className="text-xs mt-1 text-gray-500">Never share your private key. For testnet use only.</p>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-green-50 rounded border border-green-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Connected Wallet</p>
              <p className="text-sm text-gray-600">{walletAddress}</p>
              {isOwner && campaignData && (
                <p className="text-xs mt-1 text-green-600 font-semibold">Campaign Owner</p>
              )}
            </div>
            <button 
              onClick={() => {
                setWalletConnected(false);
                setWalletAddress('');
                setIsOwner(false);
                setPrivateKey('');
              }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
      
      {/* Transaction Hash Display */}
      {txHash && (
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <p className="font-semibold mb-1">Latest Transaction</p>
          <p className="text-sm text-gray-600 break-all mb-2">{txHash}</p>
          <a 
            href={getTransactionUrl(txHash)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 text-sm"
          >
            View in Explorer
          </a>
        </div>
      )}
      
      {/* Campaign Details */}
      {campaignData && (
        <div className="mb-6 p-4 border rounded">
          <h2 className="text-xl font-bold mb-1">{campaignData.title}</h2>
          <p className="mb-4 text-gray-700">{campaignData.description}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <div className="font-semibold flex items-center gap-2">
                <span className={
                  campaignData.status === CampaignStatus.Active ? "text-blue-600" :
                  campaignData.status === CampaignStatus.Computing ? "text-yellow-600" :
                  "text-green-600"
                }>
                  {getStatusName(campaignData.status)}
                </span>
                {campaignData.status === CampaignStatus.Computing && (
                  <span className="inline-block w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Funding Target</p>
              <p className="font-semibold">{campaignData.fundingTarget}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Deadline</p>
              <p className="font-semibold">{formatDate(campaignData.deadline)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Contributors</p>
              <p className="font-semibold">{campaignData.numContributors ?? 'Hidden'}</p>
            </div>
          </div>

          {campaignData.status === CampaignStatus.Completed && (
            <div className="mt-4 p-4 bg-gray-50 rounded border">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Total Raised</p>
                  <p className="text-2xl font-bold">{campaignData.totalRaised}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Campaign Result</p>
                  <p className={`font-semibold ${
                    campaignData.isSuccessful ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {campaignData.isSuccessful ? 'Success!' : 'Failed'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Campaign Actions */}
      {walletConnected && campaignData && (
        <div className="space-y-6">
          {/* Contribution Form */}
          {isCampaignActive && (
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <h3 className="font-semibold mb-3">Make a Contribution</h3>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  className="flex-1 p-2 border rounded"
                  placeholder="Enter amount"
                  disabled={loading}
                  min="1"
                />
                <button 
                  onClick={handleContribution}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                  disabled={loading || !contributionAmount}
                >
                  {loading ? 'Processing...' : 'Contribute'}
                </button>
              </div>
              <p className="text-xs mt-2 text-blue-700">Your contribution amount will remain private.</p>
            </div>
          )}
          
          {/* End Campaign Button */}
          {isCampaignActive && (
            <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
              <h3 className="font-semibold mb-3">End Campaign</h3>
              <p className="text-sm text-gray-700 mb-3">
                This will end the campaign and calculate the total raised amount.
                {!isOwner && " Only the owner can do this before the deadline."}
              </p>
              <button 
                onClick={handleEndCampaign}
                className="w-full bg-yellow-500 text-white p-2 rounded hover:bg-yellow-600 transition-colors"
                disabled={loading || (!isOwner && new Date().getTime() < campaignData.deadline)}
              >
                {loading ? 'Processing...' : 'End Campaign & Calculate Results'}
              </button>
            </div>
          )}
          
          {/* Withdraw Funds Button */}
          {canWithdraw && (
            <div className="p-4 bg-green-50 rounded border border-green-200">
              <h3 className="font-semibold mb-3">Withdraw Funds</h3>
              <p className="text-sm text-gray-700 mb-3">
                As the campaign owner, you can withdraw the raised funds since the campaign was successful.
              </p>
              <button 
                onClick={handleWithdrawFunds}
                className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 transition-colors"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Withdraw Funds'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ZKCrowdfundingApp;