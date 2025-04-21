import { useState, useCallback, useEffect } from 'react';
import BlockchainService, { 
  ProjectData, 
  ContributionResult,
  WalletInfo
} from '../services/BlockchainService';

export function useBlockchain({ 
  contractAddress, 
  refreshInterval = 10000 
}: { 
  contractAddress: string; 
  refreshInterval?: number 
}) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load project data
  const refreshProject = useCallback(async () => {
    if (!contractAddress) {
      setProject(null);
      return;
    }
    
    setLoading(true);
    
    try {
      const projectData = await BlockchainService.getProject(contractAddress);
      setProject(projectData);
      
      // Update owner status if wallet is connected
      if (wallet) {
        const ownerStatus = await BlockchainService.isProjectOwner();
        setIsOwner(ownerStatus);
      }
    } catch (err) {
      const errorMessage = `Failed to load project: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [contractAddress, wallet]);
  
  // Initial load
  useEffect(() => {
    if (contractAddress) {
      refreshProject();
    }
  }, [contractAddress, refreshProject]);
  
  // Connect wallet
  const connectWallet = useCallback(async (privateKey: string): Promise<WalletInfo | null> => {
    setLoading(true);
    
    try {
      const connectedWallet = await BlockchainService.connectWallet(privateKey);
      setWallet(connectedWallet);
      
      // Check if user is the owner
      if (contractAddress) {
        const ownerStatus = await BlockchainService.isProjectOwner();
        setIsOwner(ownerStatus);
      }
      
      return connectedWallet;
    } catch (err) {
      const errorMessage = `Failed to connect wallet: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);
  
  // Make a contribution
  const contribute = useCallback(async (amount: number): Promise<ContributionResult> => {
    setLoading(true);
    
    try {
      const result = await BlockchainService.contribute(amount);
      
      if (result.success) {
        // Refresh after a short delay
        setTimeout(() => refreshProject(), 500);
      }
      
      return result;
    } catch (err) {
      const errorMessage = `Error during contribution: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      
      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [refreshProject]);
  
  // Other methods similarly simplified
  
  return {
    project,
    wallet,
    isOwner,
    loading,
    error,
    connectWallet,
    refreshProject,
    contribute,
    startCampaign: async () => BlockchainService.startCampaign(),
    endCampaign: async () => BlockchainService.endCampaign(),
    withdrawFunds: async () => BlockchainService.withdrawFunds(),
    disconnectWallet: () => setWallet(null)
  };
}