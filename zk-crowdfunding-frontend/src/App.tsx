import React, { useState, useEffect } from 'react';
import './App.css';

// Mock API functions - these would be replaced with actual blockchain interactions
const mockFetchProject = async (address: string) => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    title: "Privacy-Preserving Research Project",
    description: "Funding research on advanced privacy techniques in blockchain applications",
    fundingTarget: 1000,
    deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
    status: "Active",
    totalRaised: null,
    numContributors: 5,
    isSuccessful: null
  };
};

const mockContribute = async (amount: number, privateKey: string) => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { success: true };
};

const mockEndCampaign = async (privateKey: string) => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 3000));
  return { 
    success: true,
    totalRaised: 1200,
    isSuccessful: true
  };
};

function App() {
  const [contractAddress, setContractAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSetAddress = async () => {
    if (!contractAddress) return;
    
    setLoading(true);
    try {
      const projectData = await mockFetchProject(contractAddress);
      setProject(projectData);
      setMessage('Project loaded successfully');
    } catch (error) {
      setMessage('Error loading project');
    }
    setLoading(false);
  };

  const handleLogin = () => {
    if (privateKey) {
      setIsLoggedIn(true);
      setMessage('Logged in successfully');
    }
  };

  const handleContribute = async () => {
    if (!isLoggedIn || !contributionAmount) return;
    
    setLoading(true);
    try {
      const amount = parseInt(contributionAmount);
      if (isNaN(amount) || amount <= 0) {
        setMessage('Please enter a valid amount');
        setLoading(false);
        return;
      }
      
      const result = await mockContribute(amount, privateKey);
      if (result.success) {
        setMessage(`Contribution of ${amount} submitted successfully!`);
        setContributionAmount('');
        // Refresh project data
        const projectData = await mockFetchProject(contractAddress);
        setProject(projectData);
      }
    } catch (error) {
      setMessage('Error submitting contribution');
    }
    setLoading(false);
  };

  const handleEndCampaign = async () => {
    if (!isLoggedIn) return;
    
    setLoading(true);
    try {
      const result = await mockEndCampaign(privateKey);
      if (result.success) {
        setMessage('Campaign ended successfully');
        // Update project with results
        setProject({
          ...project,
          status: 'Completed',
          totalRaised: result.totalRaised,
          isSuccessful: result.isSuccessful
        });
      }
    } catch (error) {
      setMessage('Error ending campaign');
    }
    setLoading(false);
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
            <button onClick={handleSetAddress} disabled={loading}>
              {loading ? 'Loading...' : 'Set Address'}
            </button>
          </div>
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
                <span>{new Date(project.deadline).toLocaleString()}</span>
              </div>
            </div>
            
            {!isLoggedIn ? (
              <div className="login-section">
                <h3>Login to Contribute</h3>
                <div className="input-group">
                  <input
                    type="password"
                    placeholder="Enter your private key"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                  />
                  <button onClick={handleLogin}>Login</button>
                </div>
              </div>
            ) : (
              <div className="action-section">
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
                        <button onClick={handleContribute} disabled={loading}>
                          {loading ? 'Processing...' : 'Contribute'}
                        </button>
                      </div>
                      <p className="privacy-note">
                        Your contribution amount will remain private throughout the campaign
                      </p>
                    </div>
                    
                    <div className="end-campaign-section">
                      <h3>End Campaign</h3>
                      <button onClick={handleEndCampaign} disabled={loading}>
                        {loading ? 'Processing...' : 'End Campaign & Compute Results'}
                      </button>
                      <p className="note">
                        This will start the computation to determine if the campaign reached its funding goal
                      </p>
                    </div>
                  </>
                )}
                
                {project.status === 'Completed' && project.isSuccessful && (
                  <div className="withdrawal-section">
                    <h3>Withdraw Funds</h3>
                    <button disabled={loading}>
                      {loading ? 'Processing...' : 'Withdraw Funds'}
                    </button>
                    <p className="note">
                      Only the project owner can withdraw funds
                    </p>
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