import { CrowdfundingClient, CampaignStatus } from './client/CrowdfundingClient';
import { useState, useEffect } from 'react';

function CrowdfundingApp() {
  // Client instance
  const [client, setClient] = useState(new CrowdfundingClient());
  
  // UI state
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [campaignData, setCampaignData] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form values
  const [campaignAddress, setCampaignAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  
  // Connect wallet with private key
  const connectWallet = async () => {
    if (!privateKey) {
      setMessage('Please enter a private key');
      return;
    }
    
    try {
      setLoading(true);
      const address = await client.connectWallet(privateKey);
      setWalletAddress(address);
      setIsConnected(true);
      setMessage(`Connected: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`);
    } catch (error) {
      setMessage(`Error connecting: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Load campaign data
  const loadCampaign = async () => {
    if (!campaignAddress) {
      setMessage('Please enter a campaign address');
      return;
    }
    
    try {
      setLoading(true);
      
      // Set campaign address in client
      client.setCampaignAddress(campaignAddress);
      
      // Load campaign data
      const data = await client.getCampaignData(campaignAddress);
      setCampaignData(data);
      
      // Load token info
      const tokenData = await client.getTokenInfo(data.tokenAddress);
      setTokenInfo(tokenData);
      
      setMessage('Campaign loaded successfully');
    } catch (error) {
      setMessage(`Error loading campaign: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Approve tokens for contribution
  const approveTokens = async () => {
    if (!isConnected || !campaignData) return;
    
    try {
      setLoading(true);
      setMessage('Approving tokens...');
      
      // Parse contribution amount
      const amount = client.parseTokenAmount(
        contributionAmount, 
        tokenInfo.decimals
      );
      
      // Approve tokens
      const result = await client.approveTokens(
        campaignData.tokenAddress,
        campaignAddress,
        amount
      );
      
      setMessage(`Token approval submitted. Transaction: ${result.transactionPointer.identifier}`);
      
      // Wait for confirmation
      await client.waitForTransaction(result.transactionPointer.identifier);
      setMessage('Token approval confirmed');
    } catch (error) {
      setMessage(`Error approving tokens: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Add contribution
  const contribute = async () => {
    if (!isConnected || !campaignData) return;
    
    try {
      setLoading(true);
      setMessage('Processing contribution...');
      
      // Convert the user-friendly amount to the raw amount
      const rawAmount = parseInt(contributionAmount) * (10 ** tokenInfo.decimals);
      
      // Make contribution
      const result = await client.addContribution(campaignAddress, rawAmount);
      
      setMessage(`Contribution submitted. Transaction: ${result.transactionPointer.identifier}`);
      
      // Wait for confirmation
      await client.waitForTransaction(result.transactionPointer.identifier);
      setMessage('Contribution confirmed');
      
      // Refresh campaign data
      loadCampaign();
    } catch (error) {
      setMessage(`Error making contribution: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // End campaign
  const endCampaign = async () => {
    if (!isConnected || !campaignData) return;
    
    try {
      setLoading(true);
      setMessage('Ending campaign...');
      
      // End campaign
      const result = await client.endCampaign(campaignAddress);
      
      setMessage(`Campaign end transaction submitted: ${result.transactionPointer.identifier}`);
      
      // Wait for confirmation
      await client.waitForTransaction(result.transactionPointer.identifier);
      setMessage('Campaign end confirmed. Computing results...');
      
      // Refresh campaign data after a delay to allow computation
      setTimeout(loadCampaign, 10000);
    } catch (error) {
      setMessage(`Error ending campaign: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Withdraw funds
  const withdrawFunds = async () => {
    if (!isConnected || !campaignData) return;
    
    try {
      setLoading(true);
      setMessage('Withdrawing funds...');
      
      // Withdraw funds
      const result = await client.withdrawFunds(campaignAddress);
      
      setMessage(`Withdrawal transaction submitted: ${result.transactionPointer.identifier}`);
      
      // Wait for confirmation
      await client.waitForTransaction(result.transactionPointer.identifier);
      setMessage('Withdrawal confirmed');
      
      // Refresh campaign data
      loadCampaign();
    } catch (error) {
      setMessage(`Error withdrawing funds: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Claim refund
  const claimRefund = async () => {
    if (!isConnected || !campaignData) return;
    
    try {
      setLoading(true);
      setMessage('Claiming refund...');
      
      // Claim refund
      const result = await client.claimRefund(campaignAddress);
      
      setMessage(`Refund transaction submitted: ${result.transactionPointer.identifier}`);
      
      // Wait for confirmation
      await client.waitForTransaction(result.transactionPointer.identifier);
      setMessage('Refund claimed successfully');
    } catch (error) {
      setMessage(`Error claiming refund: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Verify contribution
  const verifyContribution = async () => {
    if (!isConnected || !campaignData) return;
    
    try {
      setLoading(true);
      setMessage('Verifying contribution...');
      
      // Verify contribution
      const result = await client.verifyContribution(campaignAddress);
      
      setMessage(`Verification transaction submitted: ${result.transactionPointer.identifier}`);
      
      // Wait for confirmation
      const success = await client.waitForTransaction(result.transactionPointer.identifier);
      
      if (success) {
        setMessage('Contribution verified successfully! Your contribution was included in the campaign.');
      } else {
        setMessage('Verification failed. No contribution found for your address.');
      }
    } catch (error) {
      setMessage(`Error verifying contribution: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Check if user is the campaign owner
  const checkIfOwner = async () => {
    if (!isConnected || !campaignData) return false;
    
    try {
      return await client.isOwner(campaignAddress);
    } catch (error) {
      console.error("Error checking if owner:", error);
      return false;
    }
  };
  
  // Determine available actions based on campaign status
  const getAvailableActions = () => {
    if (!campaignData) return {};
    
    const isOwner = checkIfOwner();
    const currentTime = Date.now();
    const deadlinePassed = currentTime > campaignData.deadline;
    
    return {
      canContribute: 
        campaignData.status === CampaignStatus.Active && 
        !deadlinePassed && 
        isConnected,
      
      canEndCampaign: 
        campaignData.status === CampaignStatus.Active && 
        (isOwner || deadlinePassed) && 
        isConnected,
      
      canWithdraw: 
        campaignData.status === CampaignStatus.Completed && 
        campaignData.isSuccessful && 
        isOwner && 
        isConnected,
      
      canClaimRefund: 
        campaignData.status === CampaignStatus.Completed && 
        !campaignData.isSuccessful && 
        isConnected,
      
      canVerify: 
        campaignData.status === CampaignStatus.Completed && 
        isConnected
    };
  };
  
  // Format token values for display
  const formatTokenValue = (value) => {
    if (!tokenInfo || value === undefined) return 'N/A';
    
    if (typeof value === 'bigint') {
      return client.formatTokenAmount(value, tokenInfo.decimals) + ' ' + tokenInfo.symbol;
    }
    
    return value + ' ' + tokenInfo.symbol;
  };
  
  // Get campaign status text
  const getCampaignStatusText = () => {
    if (!campaignData) return '';
    
    switch (campaignData.status) {
      case CampaignStatus.Setup:
        return 'Setup - Awaiting Start';
      case CampaignStatus.Active:
        return 'Active - Accepting Contributions';
      case CampaignStatus.Computing:
        return 'Computing - Processing Results';
      case CampaignStatus.Completed:
        return campaignData.isSuccessful 
          ? 'Completed - Successfully Funded'
          : 'Completed - Funding Goal Not Reached';
      default:
        return 'Unknown';
    }
  };
  
  // Render campaign information
  const renderCampaignInfo = () => {
    if (!campaignData) return null;
    
    return (
      <div className="campaign-info">
        <h2>{campaignData.title}</h2>
        <p>{campaignData.description}</p>
        
        <div className="campaign-details">
          <div className="detail-item">
            <span className="label">Status</span>
            <span className={`value status-${campaignData.status}`}>
              {getCampaignStatusText()}
            </span>
          </div>
          
          <div className="detail-item">
            <span className="label">Token</span>
            <span className="value">
              {tokenInfo ? `${tokenInfo.name} (${tokenInfo.symbol})` : 'Loading...'}
            </span>
          </div>
          
          <div className="detail-item">
            <span className="label">Funding Goal</span>
            <span className="value">{formatTokenValue(campaignData.fundingTarget)}</span>
          </div>
          
          {campaignData.totalRaised !== undefined && (
            <div className="detail-item">
              <span className="label">Raised</span>
              <span className="value">{formatTokenValue(campaignData.totalRaised)}</span>
            </div>
          )}
          
          <div className="detail-item">
            <span className="label">Contributors</span>
            <span className="value">{campaignData.numContributors || 'Hidden'}</span>
          </div>
          
          <div className="detail-item">
            <span className="label">Deadline</span>
            <span className="value">
              {new Date(campaignData.deadline).toLocaleString()}
            </span>
          </div>
          
          <div className="detail-item">
            <span className="label">Owner</span>
            <span className="value address">
              {campaignData.owner}
              {campaignData.owner === walletAddress && (
                <span className="owner-badge">You</span>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };
  
  // Render action buttons based on campaign state
  const renderActions = () => {
    if (!campaignData || !isConnected) return null;
    
    const actions = getAvailableActions();
    
    return (
      <div className="campaign-actions">
        <h3>Available Actions</h3>
        
        {actions.canContribute && (
          <div className="action-group">
            <h4>Make a Contribution</h4>
            <div className="input-group">
              <input
                type="text"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                placeholder={`Amount in ${tokenInfo?.symbol || 'tokens'}`}
              />
              <div className="button-group">
                <button onClick={approveTokens} disabled={loading}>
                  1. Approve Tokens
                </button>
                <button onClick={contribute} disabled={loading}>
                  2. Contribute
                </button>
              </div>
              <p className="note">
                Your contribution amount will remain private until the campaign ends.
              </p>
            </div>
          </div>
        )}
        
        {actions.canEndCampaign && (
          <div className="action-item">
            <button onClick={endCampaign} disabled={loading}>
              End Campaign & Calculate Results
            </button>
            <p className="note">
              This will end the campaign and calculate the total raised amount using 
              zero-knowledge computation.
            </p>
          </div>
        )}
        
        {actions.canWithdraw && (
          <div className="action-item">
            <button 
              onClick={withdrawFunds} 
              disabled={loading}
              className="button-success"
            >
              Withdraw Funds
            </button>
            <p className="note">
              As the campaign owner, you can withdraw the total raised amount.
            </p>
          </div>
        )}
        
        {actions.canClaimRefund && (
          <div className="action-item">
            <button onClick={claimRefund} disabled={loading}>
              Claim Refund
            </button>
            <p className="note">
              The campaign did not reach its funding goal. You can claim a refund for your contribution.
            </p>
          </div>
        )}
        
        {actions.canVerify && (
          <div className="action-item">
            <button onClick={verifyContribution} disabled={loading}>
              Verify My Contribution
            </button>
            <p className="note">
              Verify that your contribution was included in the final total without revealing your amount.
            </p>
          </div>
        )}
      </div>
    );
  };
  
  // Main render function
  return (
    <div className="crowdfunding-app">
      <header>
        <h1>ZK Crowdfunding Platform</h1>
        <p>Privacy-preserving crowdfunding with token transfers on Partisia Blockchain</p>
      </header>
      
      <section className="connection-section">
        <h2>Account</h2>
        
        {!isConnected ? (
          <div className="connect-wallet">
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="Enter private key"
            />
            <button onClick={connectWallet} disabled={loading}>
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="wallet-info">
            <div className="wallet-details">
              <span className="label">Connected:</span>
              <span className="value address">{walletAddress}</span>
            </div>
            <button 
              onClick={() => {
                client.disconnect();
                setIsConnected(false);
                setWalletAddress('');
              }}
              className="disconnect-button"
            >
              Disconnect
            </button>
          </div>
        )}
      </section>
      
      <section className="campaign-section">
        <h2>Campaign</h2>
        
        <div className="load-campaign">
          <input
            type="text"
            value={campaignAddress}
            onChange={(e) => setCampaignAddress(e.target.value)}
            placeholder="Enter campaign address"
          />
          <button onClick={loadCampaign} disabled={loading}>
            Load Campaign
          </button>
        </div>
        
        {campaignData && renderCampaignInfo()}
        {campaignData && renderActions()}
      </section>
      
      {message && (
        <div className="message-container">
          <p className="message">{message}</p>
        </div>
      )}
      
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Processing...</p>
        </div>
      )}
    </div>
  );
}

export default CrowdfundingApp;