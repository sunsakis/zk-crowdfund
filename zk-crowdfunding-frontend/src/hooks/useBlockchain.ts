import { useState, useCallback, useEffect } from 'react';
import BlockchainService, { 
  ProjectData, 
  ContributionResult, 
  CampaignEndResult, 
  WithdrawalResult 
} from '../services/BlockchainService';

interface UseBlockchainProps {
  contractAddress: string;
  privateKey: string;
  refreshInterval?: number; // Refresh interval in milliseconds
}

export interface UseBlockchainReturn {
  project: ProjectData | null;
  userAddress: string;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  refreshProject: () => Promise<void>;
  contribute: (amount: number) => Promise<ContributionResult>;
  startCampaign: () => Promise<ContributionResult>;
  endCampaign: () => Promise<CampaignEndResult>;
  withdrawFunds: () => Promise<WithdrawalResult>;
}

export function useBlockchain({
  contractAddress,
  privateKey,
  refreshInterval = 10000 // Default to 10 seconds
}: UseBlockchainProps): UseBlockchainReturn {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  
  // Parse the private key and get the user address
  useEffect(() => {
    if (!privateKey) {
      setUserAddress('');
      setIsOwner(false);
      return;
    }
    
    async function parseKey() {
      try {
        const keyInfo = await BlockchainService.parsePrivateKey(privateKey);
        setUserAddress(keyInfo.address);
        
        if (contractAddress) {
          const ownerStatus = await BlockchainService.isProjectOwner(contractAddress, keyInfo.address);
          setIsOwner(ownerStatus);
        }
      } catch (err) {
        setError(`Failed to parse private key: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
    
    parseKey();
  }, [privateKey, contractAddress]);
  
  // Load project data
  const refreshProject = useCallback(async () => {
    if (!contractAddress) {
      setProject(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const projectData = await BlockchainService.getProject(contractAddress);
      setProject(projectData);
      
      // Enable auto-refresh when project is in Computing state
      setAutoRefresh(projectData.status === 'Computing');
      
      // Update owner status if user is logged in
      if (userAddress) {
        const ownerStatus = await BlockchainService.isProjectOwner(contractAddress, userAddress);
        setIsOwner(ownerStatus);
      }
    } catch (err) {
      setError(`Failed to load project: ${err instanceof Error ? err.message : "Unknown error"}`);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [contractAddress, userAddress]);
  
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
  
  // Contribute function
  const contribute = useCallback(async (amount: number): Promise<ContributionResult> => {
    if (!contractAddress || !privateKey) {
      return { 
        success: false, 
        error: 'Contract address or private key not provided' 
      };
    }
    
    setLoading(true);
    try {
      const result = await BlockchainService.contribute(contractAddress, amount, privateKey);
      if (result.success) {
        // Schedule a refresh after a short delay to allow transaction to be processed
        setTimeout(() => refreshProject(), 5000);
      }
      return result;
    } catch (err) {
      return { 
        success: false, 
        error: `Error during contribution: ${err instanceof Error ? err.message : "Unknown error"}` 
      };
    } finally {
      setLoading(false);
    }
  }, [contractAddress, privateKey, refreshProject]);
  
  // Start campaign function
  const startCampaign = useCallback(async (): Promise<ContributionResult> => {
    if (!contractAddress || !privateKey) {
      return { 
        success: false, 
        error: 'Contract address or private key not provided' 
      };
    }
    
    setLoading(true);
    try {
      const result = await BlockchainService.startCampaign(contractAddress, privateKey);
      if (result.success) {
        // Schedule a refresh after a short delay
        setTimeout(() => refreshProject(), 5000);
      }
      return result;
    } catch (err) {
      return { 
        success: false, 
        error: `Error starting campaign: ${err instanceof Error ? err.message : "Unknown error"}` 
      };
    } finally {
      setLoading(false);
    }
  }, [contractAddress, privateKey, refreshProject]);
  
  // End campaign function
  const endCampaign = useCallback(async (): Promise<CampaignEndResult> => {
    if (!contractAddress || !privateKey) {
      return { 
        success: false, 
        error: 'Contract address or private key not provided' 
      };
    }
    
    setLoading(true);
    try {
      const result = await BlockchainService.endCampaign(contractAddress, privateKey);
      if (result.success) {
        // Enable auto-refresh since computation will be in progress
        setAutoRefresh(true);
        // Schedule a refresh after a short delay
        setTimeout(() => refreshProject(), 5000);
      }
      return result;
    } catch (err) {
      return { 
        success: false, 
        error: `Error ending campaign: ${err instanceof Error ? err.message : "Unknown error"}` 
      };
    } finally {
      setLoading(false);
    }
  }, [contractAddress, privateKey, refreshProject]);
  
  // Withdraw funds function
  const withdrawFunds = useCallback(async (): Promise<WithdrawalResult> => {
    if (!contractAddress || !privateKey || !isOwner) {
      return { 
        success: false, 
        error: 'Contract address, private key not provided or not owner' 
      };
    }
    
    setLoading(true);
    try {
      const result = await BlockchainService.withdrawFunds(contractAddress, privateKey);
      if (result.success) {
        // Schedule a refresh after a short delay
        setTimeout(() => refreshProject(), 5000);
      }
      return result;
    } catch (err) {
      return { 
        success: false, 
        error: `Error withdrawing funds: ${err instanceof Error ? err.message : "Unknown error"}` 
      };
    } finally {
      setLoading(false);
    }
  }, [contractAddress, privateKey, isOwner, refreshProject]);
  
  return {
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
  };
}