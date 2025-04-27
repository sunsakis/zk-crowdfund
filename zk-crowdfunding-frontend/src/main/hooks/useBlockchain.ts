import { useState, useCallback, useEffect } from 'react';
import BlockchainService, { 
  ProjectData, 
  ContributionResult,
  WalletInfo,
  CampaignInfo,
  CreateCampaignParams
} from '../services/BlockchainService';

export function useBlockchain({ 
  contractAddress, 
  factoryAddress,
  refreshInterval = 10000 
}: { 
  contractAddress: string; 
  factoryAddress?: string;
  refreshInterval?: number 
}) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Update the current campaign address in the service
  useEffect(() => {
    if (contractAddress) {
      console.log(`Setting current campaign address to: ${contractAddress}`);
      BlockchainService.setCurrentCampaignAddress(contractAddress);
    }
  }, [contractAddress]);
  
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
      const errorMessage = `Failed to load campaign: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [contractAddress, wallet]);
  
  // Initial load and refresh when contract address changes
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
  
  // Create new campaign using the factory contract (starts immediately in Active state)
  const createCampaign = useCallback(async (params: CreateCampaignParams): Promise<ContributionResult> => {
    if (!wallet) {
      return { 
        success: false, 
        error: 'Wallet not connected' 
      };
    }
    
    if (!factoryAddress) {
      return { 
        success: false, 
        error: 'Factory contract address not configured' 
      };
    }
    
    setLoading(true);
    
    try {
      const result = await BlockchainService.createCampaign(params);
      return result;
    } catch (err) {
      const errorMessage = `Error creating campaign: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      
      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [wallet, factoryAddress]);
  
  // Get user's campaigns from the factory contract
  const getMyCampaigns = useCallback(async (): Promise<CampaignInfo[]> => {
    if (!wallet) {
      return [];
    }
    
    if (!factoryAddress) {
      console.warn('Factory address not configured');
      return [];
    }
    
    try {
      return await BlockchainService.getMyCampaigns();
    } catch (err) {
      const errorMessage = `Error fetching campaigns: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      return [];
    }
  }, [wallet, factoryAddress]);
  
  // Get all campaigns from the factory contract
  const getAllCampaigns = useCallback(async (): Promise<CampaignInfo[]> => {
    if (!factoryAddress) {
      console.warn('Factory address not configured');
      return [];
    }
    
    try {
      return await BlockchainService.getAllCampaigns();
    } catch (err) {
      const errorMessage = `Error fetching campaigns: ${err instanceof Error ? err.message : String(err)}`;
      setError(errorMessage);
      return [];
    }
  }, [factoryAddress]);
  
  // Make a contribution to the current campaign
  const contribute = useCallback(async (amount: number): Promise<ContributionResult> => {
    if (!contractAddress) {
      return { 
        success: false, 
        error: 'No campaign selected' 
      };
    }
    
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
  }, [contractAddress, refreshProject]);
  
  // End the current campaign  
  const endCampaign = useCallback(async (): Promise<ContributionResult> => {
    if (!contractAddress) {
      return { 
        success: false, 
        error: 'No campaign selected' 
      };
    }
    
    setLoading(true);
    
    try {
      const result = await BlockchainService.endCampaign();
      
      if (result.success) {
        // Refresh after a short delay
        setTimeout(() => refreshProject(), 500);
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
  }, [contractAddress, refreshProject]);
  
  // Withdraw funds from the current campaign
  const withdrawFunds = useCallback(async (): Promise<ContributionResult> => {
    if (!contractAddress) {
      return { 
        success: false, 
        error: 'No campaign selected' 
      };
    }
    
    setLoading(true);
    
    try {
      const result = await BlockchainService.withdrawFunds();
      
      if (result.success) {
        // Refresh after a short delay
        setTimeout(() => refreshProject(), 500);
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
  }, [contractAddress, refreshProject]);
  
  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setWallet(null);
    setIsOwner(false);
  }, []);
  
  // Auto-refresh for computing status
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (project?.status === 'Computing' && refreshInterval) {
      intervalId = setInterval(() => {
        refreshProject();
      }, refreshInterval);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [project?.status, refreshProject, refreshInterval]);
  
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
    endCampaign,
    withdrawFunds,
    createCampaign,
    getMyCampaigns,
    getAllCampaigns
  };
}