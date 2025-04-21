import { useState, useCallback, useEffect } from 'react';
import BlockchainService, { 
  ProjectData, 
  ContributionResult, 
  CampaignEndResult, 
  WithdrawalResult,
  WalletInfo
} from '../services/BlockchainService';

interface UseBlockchainProps {
  contractAddress: string;
  refreshInterval?: number; // Refresh interval in milliseconds
}

export interface UseBlockchainReturn {
  project: ProjectData | null;
  wallet: WalletInfo | null;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  connectWallet: () => Promise<WalletInfo | null>;
  disconnectWallet: () => void;
  refreshProject: () => Promise<void>;
  contribute: (amount: number) => Promise<ContributionResult>;
  startCampaign: () => Promise<ContributionResult>;
  endCampaign: () => Promise<CampaignEndResult>;
  withdrawFunds: () => Promise<WithdrawalResult>;
}

export function useBlockchain({
  contractAddress,
  refreshInterval = 10000 // Default to 10 seconds
}: UseBlockchainProps): UseBlockchainReturn {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  
  // Clear error message
  const clearError = () => setError(null);
  
  // Connect wallet
  const connectWallet = useCallback(async (): Promise<WalletInfo | null> => {
    clearError();
    setLoading(true);
    
    try {
      const connectedWallet = await BlockchainService.connectWallet();
      setWallet(connectedWallet);
      
      // Check if user is the owner
      if (contractAddress) {
        const ownerStatus = await BlockchainService.isProjectOwner(
          contractAddress, 
          connectedWallet.address
        );
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
  
  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setWallet(null);
    setIsOwner(false);
  }, []);
  
  // Load project data
  const refreshProject = useCallback(async () => {
    if (!contractAddress) {
      setProject(null);
      return;
    }
    
    clearError();
    setLoading(true);
    
    try {
      const projectData = await BlockchainService.getProject(contractAddress);
      setProject(projectData);
      
      // Enable auto-refresh when project is in Computing state
      setAutoRefresh(projectData.status === 'Computing');
      
      // Update owner status if wallet is connected
      if (wallet) {
        const ownerStatus = await BlockchainService.isProjectOwner(
          contractAddress, 
          wallet.address
        );
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
  
  // Auto-refresh when needed
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      refreshProject();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshProject]);
  
  // Initial load
  useEffect(() => {
    if (contractAddress) {
      refreshProject();
    }
  }, [contractAddress, refreshProject]);
  
  // Make a contribution
  const contribute = useCallback(async (amount: number): Promise<ContributionResult> => {
    if (!contractAddress) {
      return { 
        success: false, 
        error: 'Contract address not provided' 
      };
    }
    
    if (!wallet) {
      return { 
        success: false, 
        error: 'Wallet not connected' 
      };
    }
    
    clearError();
    setLoading(true);
    
    try {
      const result = await BlockchainService.contribute(
        contractAddress, 
        amount, 
        wallet
      );
      
      if (result.success) {
        // Schedule a refresh after a short delay to allow transaction to be processed
        setTimeout(() => refreshProject(), 5000);
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
  }, [contractAddress, wallet, refreshProject]);
  
  // Start the campaign
  const startCampaign = useCallback(async (): Promise<ContributionResult> => {
    if (!contractAddress) {
      return { 
        success: false, 
        error: 'Contract address not provided' 
      };
    }
    
    if (!wallet) {
      return { 
        success: false, 
        error: 'Wallet not connected' 
      };
    }
    
    clearError();
    setLoading(true);
    
    try {
      const result = await BlockchainService.startCampaign(
        contractAddress, 
        wallet
      );
      
      if (result.success) {
        // Schedule a refresh after a short delay
        setTimeout(() => refreshProject(), 5000);
      }
      
      return result;
    } catch (err) {
      const errorMessage = `Error starting campaign: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      
      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [contractAddress, wallet, refreshProject]);
  
  // End the campaign
  const endCampaign = useCallback(async (): Promise<CampaignEndResult> => {
    if (!contractAddress) {
      return { 
        success: false, 
        error: 'Contract address not provided' 
      };
    }
    
    if (!wallet) {
      return { 
        success: false, 
        error: 'Wallet not connected' 
      };
    }
    
    clearError();
    setLoading(true);
    
    try {
      const result = await BlockchainService.endCampaign(
        contractAddress, 
        wallet
      );
      
      if (result.success) {
        // Enable auto-refresh since computation will be in progress
        setAutoRefresh(true);
        // Schedule a refresh after a short delay
        setTimeout(() => refreshProject(), 5000);
      }
      
      return result;
    } catch (err) {
      const errorMessage = `Error ending campaign: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      
      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [contractAddress, wallet, refreshProject]);
  
  // Withdraw funds
  const withdrawFunds = useCallback(async (): Promise<WithdrawalResult> => {
    if (!contractAddress) {
      return { 
        success: false, 
        error: 'Contract address not provided' 
      };
    }
    
    if (!wallet) {
      return { 
        success: false, 
        error: 'Wallet not connected' 
      };
    }
    
    if (!isOwner) {
      return {
        success: false,
        error: 'Only the project owner can withdraw funds'
      };
    }
    
    clearError();
    setLoading(true);
    
    try {
      const result = await BlockchainService.withdrawFunds(
        contractAddress, 
        wallet
      );
      
      if (result.success) {
        // Schedule a refresh after a short delay
        setTimeout(() => refreshProject(), 5000);
      }
      
      return result;
    } catch (err) {
      const errorMessage = `Error withdrawing funds: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      
      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [contractAddress, wallet, isOwner, refreshProject]);
  
  return {
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
  };
}