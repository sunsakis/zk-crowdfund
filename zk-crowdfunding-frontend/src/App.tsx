import React, { useState, useEffect } from 'react';
import './App.css';
import { useBlockchain } from './hooks/useBlockchain';

// Try to load saved contract address from local storage or config file
const getSavedContractAddress = (): string => {
  try {
    // First check localStorage
    const savedAddress = localStorage.getItem('contractAddress');
    if (savedAddress) return savedAddress;
    
    // Then check if we have a config file with the address
    try {
      const loadedConfig = require('./config.json');
      if (loadedConfig.contractAddress) return loadedConfig.contractAddress;
    } catch (e) {
      // Config file might not exist, which is fine
    }
  } catch (e) {
    // Ignore error if localStorage is not available
  }
  return '';
};

function App() {
  // State variables
  const [contractAddress, setContractAddress] = useState(getSavedContractAddress());
  const [privateKey, setPrivateKey] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState('');
  
  // Use our blockchain hook
  const {
    project,
    userAddress,
    isOwner,
    loading,
    error,
    refreshProject,
    contribute,
    startCampaign,
    endCampaign,
    withdrawFunds
  } = useBlockchain({
    contractAddress,
    privateKey: isLoggedIn ? privateKey : '',
    refreshInterval: 10000 // 10 seconds
  });
  
  // Show error messages from the hook
  useEffect(() => {
    if (error) {
      setMessage(error);
    }
  }, [error]);
  
  // Handle setting the contract address
  const handleSetAddress = () => {
    if (!contractAddress) return;
    
    // Save to localStorage for persistence
    localStorage.setItem('contractAddress', contractAddress);
    
    // The hook will automatically fetch project data
    setMessage('Loading project data...');
  };

  // Handle user login with private key
  const handleLogin = async () => {
    if (!privateKey) return;
    
    setIsLoggedIn(true);
    setMessage(`Logging in...`);
  };

  // Handle contribution submission
  const handleContribute = async () => {
    if (!isLoggedIn || !contributionAmount || !contractAddress) return;
    
    const amount = parseInt(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      setMessage('Please enter a valid amount');
      return;
    }
    
    setMessage('Submitting contribution...');
    const result = await contribute(amount);
    
    if (result.success) {
      setMessage(`Contribution of ${amount} submitted successfully! Transaction ID: ${result.txId || 'pending'}`);
      setContributionAmount('');
    } else {
      setMessage(`Contribution failed: ${result.error}`);
    }
  };

  // Handle starting the campaign
  const handleStartCampaign = async () => {
    if (!isLoggedIn || !isOwner || !contractAddress) return;
    
    setMessage('Starting campaign...');
    const result = await startCampaign();
    
    if (result.success) {
      setMessage(`Campaign started successfully! Transaction ID: ${result.txId || 'pending'}`);
    } else {
      setMessage(`Failed to start campaign: ${result.error}`);
    }
  };

  // Handle ending the campaign
  const handleEndCampaign = async () => {
    if (!isLoggedIn || !contractAddress) return;
    
    setMessage('Ending campaign and starting computation...');
    const result = await endCampaign();
    
    if (result.success) {
      setMessage(`Campaign end request submitted successfully. Computation in progress... Transaction ID: ${result.txId || 'pending'}`);
    } else {
      setMessage(`Failed to end campaign: ${result.error}`);
    }
  };

  // Handle fund withdrawal
  const handleWithdrawFunds = async () => {
    if (!isLoggedIn || !isOwner || !contractAddress) return;
    
    setMessage('Withdrawing funds...');
    const result = await withdrawFunds();
    
    if (result.success) {
      setMessage(`Funds withdrawal request submitted successfully. Transaction ID: ${result.txId || 'pending'}`);
    } else {
      setMessage(`Failed to withdraw funds: ${result.error}`);
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    setMessage('Refreshing project data...');
    refreshProject();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Privacy-Preserving Crowdfunding</h1>
        <p>Contribute to projects without revealing your contribution amount</p>
      </header>

      <main>
        <section className="address-section">
          <h2>Set Contract Address</h2>
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter contract address"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
            />
            <button onClick={handleSetAddress} disabled={loading || !contractAddress}>
              {loading ? 'Loading...' : 'Set Address'}
            </button>
          </div>
          
          {contractAddress && (
            <div className="refresh-section">
              <button onClick={handleRefresh} disabled={loading} className="refresh-button">
                {loading ? 'Refreshing...' : 'Refresh State'}
              </button>
            </div>
          )}
        </section>

        {project && (
          <section className="project-section">
            <h2>{project.title}</h2>
            <p>{project.description}</p>
            
            <div className="project-details">
              <div className="detail-item">
                <span>Funding Target:</span>
                <span>{project.fundingTarget}</span>
              </div>
              
              <div className="detail-item">
                <span>Status:</span>
                <span>{project.status}</span>
              </div>
              
              <div className="detail-item">
                <span>Contributors:</span>
                <span>{project.numContributors || 0}</span>
              </div>
              
              {project.totalRaised !== null && (
                <div className="detail-item">
                  <span>Total Raised:</span>
                  <span>{project.totalRaised}</span>
                </div>
              )}
              
              {project.isSuccessful !== null && (
                <div className="detail-item">
                  <span>Campaign Result:</span>
                  <span>{project.isSuccessful ? 'Successful' : 'Failed'}</span>
                </div>
              )}
              
              <div className="detail-item">
                <span>Deadline:</span>
                <span>{new Date(project.deadline * 1000).toLocaleString()}</span>
              </div>
            </div>
            
            {!isLoggedIn ? (
              <div className="login-section">
                <h3>Login to Interact</h3>
                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Enter your private key"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                  />
                  <button onClick={handleLogin} disabled={loading || !privateKey}>Login</button>
                </div>
              </div>
            ) : (
              <div className="action-section">
                <div className="user-info">
                  <p>Logged in as: {userAddress.substring(0, 8)}...{userAddress.substring(userAddress.length - 6)}</p>
                  {isOwner && <p className="owner-badge">Project Owner</p>}
                </div>
                
                {project.status === 'Setup' && isOwner && (
                  <div className="start-campaign-section">
                    <h3>Start Campaign</h3>
                    <button 
                      onClick={handleStartCampaign} 
                      disabled={loading}
                      className="action-button"
                    >
                      {loading ? 'Processing...' : 'Start Campaign'}
                    </button>
                    <p className="note">
                      This will activate the campaign and allow contributions
                    </p>
                  </div>
                )}
                
                {project.status === 'Active' && (
                  <>
                    <div className="contribute-section">
                      <h3>Make a Private Contribution</h3>
                      <div className="input-group">
                        <input
                          type="number"
                          placeholder="Enter amount"
                          value={contributionAmount}
                          onChange={(e) => setContributionAmount(e.target.value)}
                        />
                        <button onClick={handleContribute} disabled={loading || !contributionAmount}>
                          {loading ? 'Processing...' : 'Contribute'}
                        </button>
                      </div>
                      <p className="privacy-note">
                        Your contribution amount will remain private throughout the campaign
                      </p>
                    </div>
                    
                    <div className="end-campaign-section">
                      <h3>End Campaign</h3>
                      <button 
                        onClick={handleEndCampaign} 
                        disabled={loading}
                        className="action-button"
                      >
                        {loading ? 'Processing...' : 'End Campaign & Compute Results'}
                      </button>
                      <p className="note">
                        {isOwner 
                          ? "As the owner, you can end the campaign at any time" 
                          : "Only the owner can end the campaign before the deadline"}
                      </p>
                    </div>
                  </>
                )}
                
                {project.status === 'Computing' && (
                  <div className="computing-section">
                    <h3>Computation in Progress</h3>
                    <div className="loading-indicator">
                      <div className="spinner"></div>
                    </div>
                    <p className="note">
                      The secure computation to tally all contributions is in progress.
                      This may take several minutes. The page will automatically update.
                    </p>
                  </div>
                )}
                
                {project.status === 'Completed' && project.isSuccessful && isOwner && (
                  <div className="withdrawal-section">
                    <h3>Withdraw Funds</h3>
                    <button 
                      onClick={handleWithdrawFunds} 
                      disabled={loading}
                      className="action-button"
                    >
                      {loading ? 'Processing...' : 'Withdraw Funds'}
                    </button>
                    <p className="note">
                      As the project owner, you can now withdraw the raised funds
                    </p>
                  </div>
                )}
                
                {project.status === 'Completed' && (
                  <div className="result-section">
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

        {message && (
          <div className="message-section">
            <p>{message}</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;