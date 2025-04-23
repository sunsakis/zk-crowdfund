import React, { useState, useEffect } from 'react';
import './App.css';
import { useBlockchain } from './hooks/useBlockchain';
import config from './config';

function App() {
  // State variables
  const [contractAddressInput, setContractAddressInput] = useState<string>('');
  const [contractAddress, setContractAddress] = useState<string>(config.contractAddress || '');
  const [contributionAmount, setContributionAmount] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [privateKey, setPrivateKey] = useState<string>('');
  
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
    withdrawFunds
  } = useBlockchain({
    contractAddress,
    refreshInterval: 10000 // 10 seconds
  });
  
  // Initialize contract address from config
  useEffect(() => {
    if (config.contractAddress) {
      setContractAddressInput(config.contractAddress);
      setContractAddress(config.contractAddress);
    }
  }, []);
  
  // Show error messages from the hook
  useEffect(() => {
    if (error) {
      setMessage(error);
      setMessageType('error');
    }
  }, [error]);
  
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
  
  // Handle setting the contract address
  const handleSetAddress = () => {
    if (!contractAddressInput) {
      setMessage('Please enter a contract address');
      setMessageType('error');
      return;
    }
    
    // Save to localStorage for persistence
    localStorage.setItem('contractAddress', contractAddressInput);
    setContractAddress(contractAddressInput);
    setMessage('Loading project data...');
    setMessageType('info');
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
        // Clear private key from state for security
        setPrivateKey('');
      }
    } catch (error) {
      setMessage(`Failed to connect wallet: ${error instanceof Error ? error.message : String(error)}`);
      setMessageType('error');
    }
  };
  
  // Handle wallet disconnection
  const handleDisconnectWallet = () => {
    disconnectWallet();
    setMessage('Wallet disconnected');
    setMessageType('info');
  };
  
  // Handle contribution submission
  const handleContribute = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
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
  
  // Handle starting the campaign
  const handleStartCampaign = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
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
  
  // Handle ending the campaign
  const handleEndCampaign = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
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
  
  // Handle fund withdrawal
  const handleWithdrawFunds = async () => {
    if (!wallet) {
      setMessage('Please connect your wallet first');
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
  
  // Handle manual refresh
  const handleRefresh = () => {
    setMessage('Refreshing project data...');
    setMessageType('info');
    refreshProject();
  };
  
  // Check if deadline is passed
  const isDeadlinePassed = project ? Date.now() > project.deadline : false;
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>ZK Crowdfunding</h1>
        <p>Support projects with private contributions and threshold-based reveal</p>
      </header>

      <main>
        {/* Contract Address Section */}
        <section className="address-section">
          <h2>Contract Address</h2>
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter contract address"
              value={contractAddressInput}
              onChange={(e) => setContractAddressInput(e.target.value)}
            />
            <button onClick={handleSetAddress} disabled={loading || !contractAddressInput}>
              {loading ? 'Loading...' : 'Connect to Contract'}
            </button>
          </div>
          
          {contractAddress && (
            <div className="refresh-section">
              <button onClick={handleRefresh} disabled={loading} className="refresh-button">
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          )}
        </section>

        {/* Wallet Connection Section */}
        <section className="wallet-section">
          <h2>Wallet Connection</h2>
          {!wallet ? (
            <div>
              <div className="input-group">
                <input
                  type="password"
                  placeholder="Enter private key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                />
                <button 
                  onClick={handleConnectWallet} 
                  disabled={loading || !privateKey}
                >
                  {loading ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
              <p className="note">
                Use the private key for Account-A.pk, Account-B.pk, or Account-C.pk
              </p>
            </div>
          ) : (
            <div className="wallet-info">
              <p>Connected: {wallet.address.substring(0, 6)}...{wallet.address.substring(wallet.address.length - 4)}</p>
              {isOwner && <p className="owner-badge">Project Owner</p>}
              <button 
                onClick={handleDisconnectWallet}
                className="secondary-button"
              >
                Disconnect
              </button>
            </div>
          )}
        </section>

        {/* Project Details Section */}
        {project && (
          <section className="project-section">
            <h2>{project.title}</h2>
            <p className="project-description">{project.description}</p>
            
            <div className="project-details">
              <div className="detail-item">
                <span>Status:</span>
                <span className={`status-badge status-${project.status.toLowerCase()}`}>{project.status}</span>
              </div>
              
              <div className="detail-item">
                <span>Funding Target:</span>
                <span>{project.fundingTarget}</span>
              </div>
              
              <div className="detail-item">
                <span>Deadline:</span>
                <span>{formatDate(project.deadline)} ({isDeadlinePassed ? 'Expired' : getTimeLeft(project.deadline)})</span>
              </div>
              
              {project.numContributors !== null && (
                <div className="detail-item">
                  <span>Contributors:</span>
                  <span>{project.numContributors}</span>
                </div>
              )}
              
              {project.totalRaised !== null && (
                <div className="detail-item highlight">
                  <span>Total Raised:</span>
                  <span>{project.totalRaised}</span>
                </div>
              )}
              
              {project.isSuccessful !== null && (
                <div className="detail-item highlight">
                  <span>Campaign Result:</span>
                  <span className={project.isSuccessful ? 'success-text' : 'failure-text'}>
                    {project.isSuccessful ? 'Successful' : 'Failed'}
                  </span>
                </div>
              )}
            </div>

            {/* Action Sections based on status */}
            {wallet && (
              <div className="actions-container">
                {/* Setup State - Start Campaign */}
                {project.status === 'Setup' && isOwner && (
                  <div className="action-section">
                    <h3>Start Campaign</h3>
                    <p className="action-description">
                      Once the campaign is started, contributors will be able to make private contributions.
                    </p>
                    <button 
                      onClick={handleStartCampaign} 
                      disabled={loading}
                      className="action-button"
                    >
                      {loading ? 'Processing...' : 'Start Campaign'}
                    </button>
                  </div>
                )}

                {/* Active State - Contribute */}
                {project.status === 'Active' && (
                  <div className="action-section">
                    <h3>Make a Private Contribution</h3>
                    <p className="action-description">
                      Your contribution amount will remain confidential throughout the campaign.
                    </p>
                    <div className="input-group">
                      <input
                        type="number"
                        placeholder="Enter amount"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                      />
                      <button 
                        onClick={handleContribute} 
                        disabled={loading || !contributionAmount}
                      >
                        {loading ? 'Processing...' : 'Contribute'}
                      </button>
                    </div>
                    <p className="privacy-note">
                      Only the total amount raised will be revealed if the funding target is reached.
                    </p>
                  </div>
                )}

                {/* Active State - End Campaign */}
                {project.status === 'Active' && (isOwner || isDeadlinePassed) && (
                  <div className="action-section">
                    <h3>End Campaign & Compute Results</h3>
                    <p className="action-description">
                      This will close the campaign and trigger MPC to securely compute the total raised amount.
                    </p>
                    <button 
                      onClick={handleEndCampaign} 
                      disabled={loading}
                      className="action-button"
                    >
                      {loading ? 'Processing...' : 'End Campaign'}
                    </button>
                    <p className="note">
                      {isOwner 
                        ? "As the owner, you can end the campaign at any time" 
                        : "Anyone can end the campaign after the deadline has passed"}
                    </p>
                  </div>
                )}

                {/* Computing State */}
                {project.status === 'Computing' && (
                  <div className="action-section computing-section">
                    <h3>Computation in Progress</h3>
                    <div className="loading-indicator">
                      <div className="spinner"></div>
                    </div>
                    <p className="action-description">
                      The Multi-Party Computation to securely tally all contributions is in progress.
                      The page will automatically refresh when complete.
                    </p>
                  </div>
                )}

                {/* Completed State - Withdraw Funds */}
                {project.status === 'Completed' && project.isSuccessful && isOwner && (
                  <div className="action-section">
                    <h3>Withdraw Funds</h3>
                    <p className="action-description">
                      As the project owner, you can now withdraw the raised funds.
                    </p>
                    <button 
                      onClick={handleWithdrawFunds} 
                      disabled={loading}
                      className="action-button"
                    >
                      {loading ? 'Processing...' : 'Withdraw Funds'}
                    </button>
                  </div>
                )}

                {/* Completed State - Results */}
                {project.status === 'Completed' && (
                  <div className="action-section result-section">
                    <h3>Campaign Results</h3>
                    <div className={`result ${project.isSuccessful ? 'success' : 'failure'}`}>
                      <p>
                        {project.isSuccessful 
                          ? `Successfully raised ${project.totalRaised} (target: ${project.fundingTarget})` 
                          : `Did not meet the target (raised ${project.totalRaised} of ${project.fundingTarget})`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Message Section */}
        {message && (
          <div className={`message-section ${messageType}`}>
            <p>{message}</p>
          </div>
        )}

        {/* Privacy Information */}
        <section className="info-section">
          <h3>About Zero-Knowledge Crowdfunding</h3>
          <p>
            This platform uses Partisia Blockchain's Multi-Party Computation (MPC) technology to keep individual
            contributions private while ensuring transparency in the overall funding process.
          </p>
          <ul>
            <li><strong>Confidential Contributions:</strong> Individual contribution amounts remain private throughout the entire process.</li>
            <li><strong>Threshold-Based Reveal:</strong> The total raised amount is only revealed after the campaign ends.</li>
            <li><strong>Fair Verification:</strong> MPC ensures that the computation is done correctly without exposing sensitive data.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;