import { useContext, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { CrowdfundAction } from "./permissions";

/**
 * Main auth hook that provides access to the auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Hook for checking crowdfund-specific permissions
 */
export function usePermission(action: CrowdfundAction, campaignId?: string) {
  const { canPerformAction, isConnected } = useAuth();
  return useCallback(async () => {
    if (!isConnected || !campaignId) return false;
    return canPerformAction(action, campaignId);
  }, [isConnected, canPerformAction, action, campaignId]);
}

// Convenience hooks for common permission checks
export const useCanEndCampaign = (campaignId?: string) =>
  usePermission("end_campaign", campaignId);

export const useCanWithdrawFunds = (campaignId?: string) =>
  usePermission("withdraw_funds", campaignId);

export const useIsOwner = (campaignId?: string) =>
  usePermission("end_campaign", campaignId); // Using end_campaign as proxy for ownership check
