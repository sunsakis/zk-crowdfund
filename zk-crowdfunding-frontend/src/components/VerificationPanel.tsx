import React, { useState, useEffect } from 'react';

interface VerificationPanelProps {
  contractAddress: string;
  isConnected: boolean;
  campaignStatus: number; // Using the CampaignStatus enum (0=Active, 1=Computing, 2=Completed)
  totalRaised: number | null;
  targetAmount: number;
  contributorCount: number | null;
  verifyContribution: () => Promise<any>;
}

const VerificationPanel: React.FC<VerificationPanelProps> = ({
  contractAddress,
  isConnected,
  campaignStatus,
  totalRaised,
  targetAmount,
  contributorCount,
  verifyContribution
}) => {
  const [contributionHash, setContributionHash] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Load saved contribution receipt on mount
  useEffect(() => {
    const savedReceipt = localStorage.getItem(`contribution_receipt_${contractAddress}`);
    if (savedReceipt) {
      setContributionHash(savedReceipt);
    }
  }, [contractAddress]);
  
  const handleVerify = async () => {
    if (!isConnected) {
      setErrorMessage('Please connect your wallet first');
      return;
    }
    
    try {
      setVerificationStatus('verifying');
      setErrorMessage(null);
      
      await verifyContribution();
      
      setVerificationStatus('verified');
    } catch (error) {
      setVerificationStatus('error');
      setErrorMessage(error.message || 'Verification failed');
    }
  };
  
  // Only show the verification panel for completed campaigns
  if (campaignStatus !== 2) { // 2 = Completed
    return null;
  }
  
  return (
    <div className="card mt-6">
      <h2 className="card-title">Contribution Verification</h2>
      
      <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
        <h3 className="font-semibold mb-2 text-blue-700">Verification System</h3>
        <p className="text-sm text-blue-700">
          Our crowdfunding platform uses zero-knowledge proofs to keep individual contributions private
          while ensuring fair computation of totals. You can verify your contribution was included in
          the final total without revealing your contribution amount.
        </p>
      </div>
      
      {verificationStatus === 'verified' ? (
        <div className="bg-green-50 p-4 rounded-md border border-green-200 mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-green-700 font-medium">Your contribution has been verified!</span>
          </div>
          <p className="text-sm text-green-600 mt-2">
            Your contribution was included in the final tally of 
            {contributorCount && <strong> {contributorCount} </strong>} 
            total contributions.
          </p>
        </div>
      ) : (
        <div className="mb-4">
          {contributionHash ? (
            <>
              <p className="text-sm text-gray-600 mb-2">Your Contribution Receipt:</p>
              <div className="bg-gray-100 p-3 rounded font-mono text-xs break-all mb-4">
                {contributionHash}
              </div>
            </>
          ) : (
            <p className="text-sm text-yellow-600 mb-4">
              No contribution receipt found. If you contributed to this campaign,
              you can still verify using your wallet address.
            </p>
          )}
          
          <button
            onClick={handleVerify}
            disabled={verificationStatus === 'verifying' || !isConnected}
            className="btn btn-primary w-full"
          >
            {verificationStatus === 'verifying' ? (
              <span className="flex items-center justify-center">
                <span className="mr-2 inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Verifying...
              </span>
            ) : 'Verify My Contribution'}
          </button>
          
          {errorMessage && (
            <div className="mt-2 text-sm text-red-600">
              {errorMessage}
            </div>
          )}
        </div>
      )}
      
      <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
        <h3 className="font-semibold mb-2">Campaign Stats</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Raised</p>
            <p className="font-semibold">{totalRaised !== null ? totalRaised : 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Target</p>
            <p className="font-semibold">{targetAmount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Contributors</p>
            <p className="font-semibold">{contributorCount !== null ? contributorCount : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerificationPanel;