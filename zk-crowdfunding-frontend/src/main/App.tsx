import React, { useState, useEffect, useRef } from 'react';
import { Buffer } from 'buffer';
import { CrowdfundingClient, CampaignStatus } from './client/CrowdfundingClient';

const ZKCrowdfunding = () => {
  // State
  const [privateKey, setPrivateKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [contractAddress, setContractAddress] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [contributionAmount, setContributionAmount] = useState('');
  const [campaign, setCampaign] = useState(null);
  const [view, setView] = useState('connect');
  const [txHash, setTxHash] = useState('');
  
  // Create a ref for the client to persist between renders
  const clientRef = useRef(new CrowdfundingClient());
  
  // Connect wallet using private key
  const connectWallet = async () => {
    if (!privateKey.trim()) {
      showMessage('Please enter your private key', 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      // Connect wallet using our client
      const address = await clientRef.current.connectWallet(privateKey);
      
      setWalletAddress(address);
      setConnected(true);
      setView('campaign');
      showMessage(`Connected successfully as ${address.substring(0, 6)}...${address.substring(address.length - 4)}`, 'success');
    } catch (error) {
      showMessage(`Connection failed: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Load campaign data
  const loadCampaign = async () => {
    if (!contractAddress.trim()) {
      showMessage('Please enter a campaign address', 'error');
      return;
    }
    
    // Validate contract address format
    const regex = /^[0-9a-fA-F]{42}$/;
    if (!regex.test(contractAddress)) {
      showMessage('Invalid contract address format', 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      // Fetch campaign data from the blockchain using our client
      const campaignData = await clientRef.current.getCampaignData(contractAddress);
      
      setCampaign(campaignData);
      setView('campaign-details');
      
      // Add browser link
      const browserLink = document.querySelector("#browser-link");
      if (browserLink) {
        const url = clientRef.current.getContractUrl(contractAddress);
        browserLink.innerHTML = `<a href="${url}" target="_blank">View on blockchain explorer</a>`;
      }
      
      showMessage('Campaign loaded successfully', 'success');
    } catch (error) {
      showMessage(`Error loading campaign: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Contribute to campaign
  const addContribution = async () => {
    if (!connected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }
    
    if (!contributionAmount || isNaN(Number(contributionAmount)) || Number(contributionAmount) <= 0) {
      showMessage('Please enter a valid contribution amount', 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      // Call the client to submit our ZK contribution
      const amount = parseInt(contributionAmount);
      const txId = await clientRef.current.addContribution(amount);
      
      // Set transaction hash for displaying a link
      setTxHash(txId);
      
      // Display success message with link to transaction
      const txUrl = clientRef.current.getTransactionUrl(txId);
      
      showMessage(
        `Contribution of ${contributionAmount} submitted as a zero-knowledge input. ` + 
        `<a href="${txUrl}" target="_blank">View transaction</a>`, 
        'success'
      );
      
      setContributionAmount('');
      
      // Update local state to reflect the new contribution
      setCampaign(prev => ({
        ...prev,
        numContributors: (prev.numContributors || 0) + 1
      }));
    } catch (error) {
      showMessage(`Error submitting contribution: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // End campaign and compute results
  const endCampaign = async () => {
    if (!connected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      // Call the client to end the campaign
      const txId = await clientRef.current.endCampaign(contractAddress);
      
      // Set transaction hash for displaying a link
      setTxHash(txId);
      
      // Display success message with link to transaction
      const txUrl = clientRef.current.getTransactionUrl(txId);
      
      // Update campaign status to computing
      setCampaign(prev => ({
        ...prev,
        status: CampaignStatus.COMPUTING
      }));
      
      showMessage(
        `Campaign end initiated. Computing results... ` +
        `<a href="${txUrl}" target="_blank">View transaction</a>`,
        'success'
      );
      
      // Schedule a state refresh after a delay to show updated status
      setTimeout(() => {
        loadCampaign();
      }, 10000);
    } catch (error) {
      showMessage(`Error ending campaign: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Withdraw funds
  const withdrawFunds = async () => {
    if (!connected) {
      showMessage('Please connect your wallet first', 'error');
      return;
    }
    
    if (!campaign || !campaign.isSuccessful) {
      showMessage('Can only withdraw funds from successful campaigns', 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      // Call the client to withdraw funds
      const txId = await clientRef.current.withdrawFunds(contractAddress);
      
      // Set transaction hash for displaying a link
      setTxHash(txId);
      
      // Display success message with link to transaction
      const txUrl = clientRef.current.getTransactionUrl(txId);
      
      showMessage(
        `Funds withdrawal initiated. ` +
        `<a href="${txUrl}" target="_blank">View transaction</a>`,
        'success'
      );
    } catch (error) {
      showMessage(`Error withdrawing funds: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Display message with timeout
  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    
    // Clear message after 5 seconds
    setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 5000);
  };
  
  // Disconnect wallet
  const disconnectWallet = () => {
    // Disconnect the client
    clientRef.current.disconnect();
    
    // Reset state
    setConnected(false);
    setWalletAddress('');
    setPrivateKey('');
    setCampaign(null);
    setView('connect');
    showMessage('Wallet disconnected', 'info');
  };
  
  // Auto-load campaign data if contractAddress is in URL or localStorage
  useEffect(() => {
    const savedAddress = localStorage.getItem('zk-crowdfunding-address');
    if (savedAddress) {
      setContractAddress(savedAddress);
    }
    
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const addressParam = urlParams.get('address');
    if (addressParam) {
      setContractAddress(addressParam);
    }
    
    // If we have a contract address and wallet connected, load the campaign
    if (contractAddress && connected) {
      loadCampaign();
    }
  }, [connected]);
  
  // Render the wallet connection view
  const renderConnectView = () => (
    <div className="wallet-connect-container">
      <h2>Connect Your Wallet</h2>
      <p className="subtitle">Connect with your Partisia wallet to interact with ZK crowdfunding campaigns</p>
      
      <div className="input-group">
        <input
          type="password"
          placeholder="Enter your private key"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          disabled={loading}
        />
        <button 
          onClick={connectWallet}
          disabled={loading || !privateKey}
          className="primary-button"
        >
          {loading ? "Connecting..." : "Connect Wallet"}
        </button>
      </div>
      <p className="note">For demo purposes only. Never share your actual private key.</p>
    </div>
  );
  
  // Render campaign view
  const renderCampaignView = () => (
    <div className="campaign-view">
      <div className="address-bar">
        <span className="wallet-pill">
          {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
        </span>
        <button className="text-button" onClick={disconnectWallet}>
          Disconnect
        </button>
      </div>
      
      <div className="campaign-container">
        <h2>View Campaign</h2>
        <p className="subtitle">Enter a campaign address to view details and contribute</p>
        
        <div className="input-group">
          <input
            type="text"
            placeholder="Enter campaign contract address"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            disabled={loading}
          />
          <button 
            onClick={loadCampaign}
            disabled={loading || !contractAddress}
            className="primary-button"
          >
            {loading ? "Loading..." : "View Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
  
  // Render campaign details
  const renderCampaignDetails = () => {
    if (!campaign) return null;
    
    return (
      <div className="campaign-details">
        <div className="address-bar">
          <span className="wallet-pill">
            {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
          </span>
          <button className="text-button" onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
        
        <div className="back-link">
          <button className="text-button" onClick={() => setView('campaign')}>
            ← Back to search
          </button>
        </div>
        
        <div className="campaign-card">
          <h2>{campaign.title}</h2>
          <p className="campaign-description">{campaign.description}</p>
          
          <div className="campaign-meta">
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className={`status-badge status-${campaign.status === CampaignStatus.ACTIVE ? 'active' : campaign.status === CampaignStatus.COMPUTING ? 'computing' : 'completed'}`}>
                {campaign.status === CampaignStatus.ACTIVE ? "Active" : 
                 campaign.status === CampaignStatus.COMPUTING ? "Computing" : "Completed"}
              </span>
            </div>
            
            <div className="meta-item">
              <span className="meta-label">Target</span>
              <span className="meta-value">{campaign.fundingTarget}</span>
            </div>
            
            <div className="meta-item">
              <span className="meta-label">Contributors</span>
              <span className="meta-value">{campaign.contributors}</span>
            </div>
            
            <div className="meta-item">
              <span className="meta-label">Total Raised</span>
              <span className="meta-value">{campaign.totalRaised !== null ? campaign.totalRaised : "Hidden (ZK Protected)"}</span>
            </div>
          </div>
          
          {campaign.status === CampaignStatus.COMPLETED && (
            <div className={`result-banner ${campaign.isSuccessful ? 'success' : 'failure'}`}>
              {campaign.isSuccessful 
                ? `Campaign Successful! Raised ${campaign.totalRaised} of ${campaign.fundingTarget} target.` 
                : `Campaign Unsuccessful. Only raised ${campaign.totalRaised} of ${campaign.fundingTarget} needed.`}
            </div>
          )}
          
          <div className="campaign-actions">
            {campaign.status === CampaignStatus.ACTIVE && (
              <div className="contribution-form">
                <h3>Make a Contribution</h3>
                <div className="input-group">
                  <input
                    type="number"
                    placeholder="Enter amount"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    disabled={loading}
                  />
                  <button 
                    onClick={addContribution}
                    disabled={loading || !contributionAmount}
                    className="primary-button"
                  >
                    {loading ? "Processing..." : "Contribute"}
                  </button>
                </div>
                <p className="note privacy-note">Your contribution amount will remain private until the campaign ends.</p>
              </div>
            )}
            
            {campaign.status === CampaignStatus.ACTIVE && (
              <button
                onClick={endCampaign}
                disabled={loading}
                className="secondary-button"
              >
                {loading ? "Processing..." : "End Campaign & Compute Results"}
              </button>
            )}
            
            {campaign.status === CampaignStatus.COMPLETED && campaign.isSuccessful && (
              <button
                onClick={withdrawFunds}
                disabled={loading}
                className="primary-button"
              >
                {loading ? "Processing..." : "Withdraw Funds"}
              </button>
            )}
          </div>
        </div>
        
        <div className="privacy-card">
          <h3>🔒 Zero-Knowledge Privacy</h3>
          <ul>
            <li>Individual contribution amounts remain confidential</li>
            <li>Total is only revealed after campaign completes</li>
            <li>Powered by Partisia Blockchain MPC technology</li>
          </ul>
        </div>
      </div>
    );
  };
  
  return (
    <div className="zk-crowdfunding-app">
      <div className="app-container">
        <div className="app-header">
          <h1>ZK Crowdfunding</h1>
          <p className="tagline">Privacy-preserving fundraising with zero-knowledge proofs</p>
        </div>
        
        {message.text && (
          <div 
            className={`message ${message.type}`}
            dangerouslySetInnerHTML={{ __html: message.text }}
          />
        )}
        
        {view === 'connect' && renderConnectView()}
        {view === 'campaign' && renderCampaignView()}
        {view === 'campaign-details' && renderCampaignDetails()}
      </div>
    </div>
  );
};

// Add CSS styles
const styles = `
  :root {
    --primary-color: #5f2eea;
    --primary-light: #8466ef;
    --primary-dark: #4921af;
    --secondary-color: #38d1bd;
    --dark-text: #161b37;
    --light-text: #f5f5fa;
    --background: #f2f2fa;
    --card-bg: #ffffff;
    --border-color: #e6e8f0;
    --success: #38cb89;
    --warning: #ffab00;
    --error: #ef4444;
    --border-radius: 8px;
    --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .zk-crowdfunding-app {
    font-family: Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, sans-serif;
    color: var(--dark-text);
    background: var(--background);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1.5;
  }

  .app-container {
    width: 100%;
    max-width: 500px;
    background: var(--card-bg);
    border-radius: 20px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    padding: 32px;
  }

  .app-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .app-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 8px 0;
  }

  .tagline {
    color: #6e7191;
    font-size: 16px;
    margin: 0;
    font-weight: 400;
  }

  .subtitle {
    color: #6e7191;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .wallet-connect-container, .campaign-container {
    margin-top: 24px;
  }

  h2 {
    font-size: 24px;
    font-weight: 600;
    margin-top: 0;
    margin-bottom: 12px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 16px;
  }

  .input-group input {
    width: 100%;
    padding: 12px 16px;
    font-size: 16px;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    margin-bottom: 12px;
    transition: border 0.2s;
  }

  .input-group input:focus {
    border-color: var(--primary-color);
    outline: none;
  }

  button {
    cursor: pointer;
    font-weight: 500;
    font-size: 16px;
    border: none;
    border-radius: var(--border-radius);
    transition: all 0.2s;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .primary-button {
    background-color: var(--primary-color);
    color: white;
    padding: 12px 20px;
    width: 100%;
  }

  .primary-button:hover:not(:disabled) {
    background-color: var(--primary-dark);
  }

  .secondary-button {
    background-color: var(--secondary-color);
    color: var(--dark-text);
    padding: 12px 20px;
    width: 100%;
    margin-top: 12px;
  }

  .text-button {
    background: none;
    color: var(--primary-color);
    padding: 4px 8px;
    font-size: 14px;
  }

  .text-button:hover {
    text-decoration: underline;
  }

  .note {
    font-size: 12px;
    color: #6e7191;
    margin-top: 8px;
  }

  .privacy-note {
    color: var(--primary-color);
    font-style: italic;
  }

  .message {
    padding: 12px 16px;
    border-radius: var(--border-radius);
    margin-bottom: 16px;
    font-size: 14px;
  }

  .message.error {
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--error);
    border-left: 4px solid var(--error);
  }

  .message.success {
    background-color: rgba(56, 203, 137, 0.1);
    color: var(--success);
    border-left: 4px solid var(--success);
  }

  .message.info {
    background-color: rgba(95, 46, 234, 0.1);
    color: var(--primary-color);
    border-left: 4px solid var(--primary-color);
  }

  .address-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 20px;
  }

  .wallet-pill {
    background-color: #1e1e27;
    color: white;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 14px;
    margin-right: 12px;
  }

  .back-link {
    margin-bottom: 16px;
  }

  .campaign-card {
    background-color: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 20px;
    margin-bottom: 16px;
  }

  .campaign-card h2 {
    font-size: 22px;
    margin-bottom: 8px;
  }

  .campaign-description {
    color: #6e7191;
    font-size: 15px;
    margin-bottom: 16px;
  }

  .campaign-meta {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
  }

  .meta-label {
    font-size: 12px;
    color: #6e7191;
    margin-bottom: 4px;
  }

  .meta-value {
    font-weight: 600;
    font-size: 16px;
  }

  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
  }

  .status-active {
    background-color: var(--success);
    color: white;
  }

  .status-computing {
    background-color: var(--warning);
    color: var(--dark-text);
  }

  .status-completed {
    background-color: #6e7191;
    color: white;
  }

  .result-banner {
    padding: 12px 16px;
    border-radius: var(--border-radius);
    margin-bottom: 20px;
    font-weight: 500;
    text-align: center;
  }

  .result-banner.success {
    background-color: rgba(56, 203, 137, 0.1);
    color: var(--success);
    border: 1px solid var(--success);
  }

  .result-banner.failure {
    background-color: rgba(239, 68, 68, 0.1);
    color: var(--error);
    border: 1px solid var(--error);
  }

  .contribution-form {
    background-color: rgba(95, 46, 234, 0.05);
    padding: 16px;
    border-radius: var(--border-radius);
    margin-bottom: 16px;
  }

  .contribution-form h3 {
    font-size: 18px;
    margin-top: 0;
    margin-bottom: 12px;
  }

  .campaign-actions {
    margin-top: 20px;
  }

  .privacy-card {
    background-color: #f9f9ff;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 16px;
  }

  .privacy-card h3 {
    font-size: 16px;
    margin-top: 0;
    margin-bottom: 12px;
  }

  .privacy-card ul {
    margin: 0;
    padding-left: 24px;
  }

  .privacy-card li {
    margin-bottom: 8px;
    font-size: 14px;
  }
`;

// Apply the styles
const styleElement = document.createElement('style');
styleElement.innerText = styles;
document.head.appendChild(styleElement);

export default ZKCrowdfunding;