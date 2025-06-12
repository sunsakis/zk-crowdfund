import { BlockchainAddress } from "@partisiablockchain/abi-client";
import { CampaignStatusD, ContractState } from "@/contracts/CrowdfundGenerated";

export type CrowdfundAction =
  | "end_campaign"
  | "withdraw_funds"
  | "contribute_tokens";

export function checkPermission(
  action: CrowdfundAction,
  state: ContractState,
  userAddress: BlockchainAddress
): boolean {
  const isOwner = state.owner.asString() === userAddress.asString();

  switch (action) {
    case "end_campaign":
      return isOwner && state.status.discriminant === CampaignStatusD.Active;
    case "withdraw_funds":
      return isOwner && state.status.discriminant === CampaignStatusD.Completed;
    case "contribute_tokens":
      return true; // Anyone can contribute
    default:
      return false;
  }
}
