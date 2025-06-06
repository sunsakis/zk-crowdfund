import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Crowdfunding } from "@/hooks/useCampaignContract";
import { CampaignStatusD } from "@/contracts/CrowdfundGenerated";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  useContribute,
  useContributeSecret,
  useEndCampaign,
  useWithdrawFunds,
} from "@/hooks/useCampaignContract";
import { ExternalLinkIcon } from "lucide-react";
import { TransactionDialog } from "@/components/shared/TransactionDialog";
import { StepTransactionDialog } from "@/components/shared/StepTransactionDialog";
import { TransactionPointer } from "@/hooks/useCampaignTransaction";
import { useTransactionStatus } from "@/hooks/useTransactionStatus";
import { useAuth } from "@/auth/useAuth";
import ConnectButton from "./shared/ConnectButton";

interface CrowdfundingCardProps {
  campaign: Crowdfunding;
  campaignId: string;
}

const MAX_AMOUNT = 2147.483647;
const MIN_AMOUNT = 0.000001;

// Helper functions for token unit conversion
function tokenUnitsToDisplayAmount(tokenUnits: number): number {
  return tokenUnits / 1_000_000;
}

export function CrowdfundingCard({
  campaign,
  campaignId,
}: CrowdfundingCardProps) {
  const { isConnected, walletAddress } = useAuth();
  const [amount, setAmount] = useState<string>("");
  const {
    mutateAsync: contribute,
    isPending: isContributing,
    requiresWalletConnection: requiresWalletForContribute,
  } = useContribute();
  const {
    mutateAsync: contributeSecret,
    isPending: isContributingSecret,
    steps: secretSteps,
    requiresWalletConnection: requiresWalletForSecret,
  } = useContributeSecret();
  const [amountInputError, setAmountInputError] = useState<string | null>(null);
  const [transactionPointer, setTransactionPointer] =
    useState<TransactionPointer | null>(null);
  const [isTransactionInProgress, setIsTransactionInProgress] = useState(false);
  const [transactionError, setTransactionError] = useState<Error | null>(null);
  const transactionStatus = useTransactionStatus(
    transactionPointer?.identifier ?? "",
    "other"
  );
  const { mutateAsync: endCampaign, isPending: isEnding } = useEndCampaign();
  const { mutateAsync: withdrawFunds, isPending: isWithdrawing } =
    useWithdrawFunds();
  const [adminTxnResult, setAdminTxnResult] = useState<
    TransactionPointer | { error: unknown } | null
  >(null);
  const [adminAction, setAdminAction] = useState<null | "end" | "withdraw">(
    null
  );

  const isTotalRevealed =
    campaign.totalRaised !== undefined &&
    campaign.totalRaised >= campaign.fundingTarget;

  const progress =
    campaign.totalRaised !== undefined
      ? ((campaign.totalRaised ?? 0) / campaign.fundingTarget) * 100
      : 0;

  const isOwner =
    walletAddress &&
    campaign.owner?.asString &&
    walletAddress.toLowerCase() === campaign.owner.asString().toLowerCase();

  const canEnd = campaign.status.discriminant === CampaignStatusD.Active;
  const canWithdraw =
    campaign.status.discriminant === CampaignStatusD.Completed &&
    !campaign.fundsWithdrawn &&
    (campaign.numContributors ?? 0) > 0;

  const showAdminActions =
    isOwner &&
    ((campaign.status.discriminant === CampaignStatusD.Active && canEnd) ||
      (campaign.status.discriminant === CampaignStatusD.Completed &&
        canWithdraw));

  const showConnectButton =
    (!isConnected &&
      campaign.status.discriminant === CampaignStatusD.Completed &&
      !campaign.fundsWithdrawn) ||
    (campaign.status.discriminant === CampaignStatusD.Active && !isOwner);

  const showContributeSection =
    campaign.status.discriminant === CampaignStatusD.Active;

  const handleContribute = async (isSecret: boolean) => {
    // Reset all transaction state before starting a new transaction
    setTransactionPointer(null);
    setTransactionError(null);
    setIsTransactionInProgress(false);

    if (amount === "") {
      setAmountInputError("Please enter an amount");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < MIN_AMOUNT || amountNum > MAX_AMOUNT) {
      setAmountInputError(
        `Please enter an amount between ${MIN_AMOUNT} and ${MAX_AMOUNT}`
      );
      return;
    }

    if (isSecret && requiresWalletForSecret()) {
      setAmountInputError("Please connect your wallet");
      return;
    }

    if (!isSecret && requiresWalletForContribute()) {
      setAmountInputError("Please connect your wallet");
      return;
    }

    // Convert display amount to raw token units (1_000_000 = 1 token)
    const rawAmount = Math.round(amountNum * 1_000_000);

    try {
      setIsTransactionInProgress(true);
      setTransactionError(null);
      const params = {
        crowdfundingAddress: campaignId,
        amount: rawAmount,
        tokenAddress: campaign.tokenAddress.asString(),
      };

      const result = isSecret
        ? await contributeSecret(params)
        : await contribute(params);

      if (result.error) {
        setTransactionError(result.error);
        setTransactionPointer(result);
      } else if (result) {
        setTransactionPointer(result);
        setAmount("");
        setAmountInputError(null);
      }
    } catch (error) {
      console.error("Contribution error:", error);
      setTransactionError(
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      setIsTransactionInProgress(false);
    }
  };

  const handleTransactionComplete = () => {
    setTransactionPointer(null);
    setTransactionError(null);
    setIsTransactionInProgress(false);
  };

  const handleAdminAction = async (action: "end" | "withdraw") => {
    try {
      setAdminAction(action);
      setAdminTxnResult(null);
      if (action === "end") {
        const result = await endCampaign(campaignId);
        setAdminTxnResult(result);
      } else if (action === "withdraw") {
        const result = await withdrawFunds(campaignId);
        setAdminTxnResult(result);
      }
    } catch (e) {
      setAdminTxnResult({ error: e });
    }
  };

  const handleAdminDialogClose = () => {
    setAdminTxnResult(null);
    setAdminAction(null);
  };

  const getStatusText = (status: Crowdfunding["status"]) => {
    switch (status.discriminant) {
      case CampaignStatusD.Active:
        return "Active";
      case CampaignStatusD.Computing:
        return "Computing";
      case CampaignStatusD.Completed:
        return "Ended";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="pb-1 px-1 bg-violet-100 rounded-xl w-lg">
      <div className="py-1 pl-2">
        <code className="uppercase text-xs font-mono text-violet-600 tracking-wide">
          {campaign.shardId} ♦️ {campaignId}
        </code>
      </div>
      <Card className="w-full max-w-2xl shadow-none border-none mt-1">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">{campaign.title}</CardTitle>
          <CardDescription className="text-base">
            {campaign.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span
                className={progress > 100 ? "text-violet-600 font-medium" : ""}
              >
                {progress > 100 ? "⚡ " : ""}
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="relative">
              <Progress
                value={Math.min(100, progress)}
                className={`h-2 transition-all duration-300 ${
                  progress > 100 ? "bg-violet-100" : ""
                }`}
              />
              {progress > 100 && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-violet-600 to-amber-500 opacity-80 h-2 rounded-full animate-pulse" />
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-400 via-violet-500 to-amber-400 opacity-60 h-2 rounded-full animate-pulse [animation-delay:150ms]" />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-[2px] bg-violet-600"
                    style={{ left: `${progress}%` }}
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 text-sm">
            <div>
              <p className="text-muted-foreground">Total Raised</p>
              {campaign.status.discriminant === CampaignStatusD.Completed &&
              !campaign.isSuccessful ? (
                <p className="text-sm bg-red-100 text-red-600 px-2 py-1 rounded-sm w-fit">
                  Campaign ended without meeting target 😔
                </p>
              ) : isTotalRevealed ? (
                <p className="text-lg font-medium">
                  {tokenUnitsToDisplayAmount(campaign.totalRaised ?? 0).toFixed(
                    6
                  )}{" "}
                  tokens
                </p>
              ) : (
                <p className="text-sm bg-neutral-100 text-neutral-500 px-2 py-1 rounded-sm w-fit">
                  Hidden until target reached
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Funding Target</p>
              <p className="text-lg font-medium">
                {`${tokenUnitsToDisplayAmount(campaign.fundingTarget).toFixed(6)} tokens`}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Contributors</p>
              <p className="text-lg font-medium">
                {campaign.numContributors ?? 0}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="text-lg font-medium">
                {getStatusText(campaign.status)}
              </p>
            </div>
          </div>

          {showContributeSection && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount to give"
                  className={`flex-1 rounded-md border-2 px-3 py-2 ${
                    amountInputError ? "border-red-500" : ""
                  }`}
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  step={MIN_AMOUNT}
                />
                {isConnected ? (
                  <Button
                    className="bg-violet-800 hover:bg-violet-600 shadow-none h-10"
                    onClick={() => handleContribute(true)}
                    disabled={isContributing || isContributingSecret}
                  >
                    Contribute secretly
                  </Button>
                ) : (
                  <ConnectButton label="Connect to give" />
                )}
              </div>
              {amountInputError && (
                <p className="text-xs text-red-500">{amountInputError}</p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(campaign.lastUpdated).toLocaleString()}
          </p>
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground">
          <a
            href={`https://browser.testnet.partisiablockchain.com/contracts/${campaignId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-600 hover:bg-violet-200"
          >
            view on explorer <ExternalLinkIcon className="w-3 h-3 ml-1" />
          </a>

          {showConnectButton && (
            <div className="ml-auto">
              <ConnectButton label="Manage campaign" />
            </div>
          )}

          {showAdminActions && (
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                disabled={!canEnd || isEnding}
                onClick={() => handleAdminAction("end")}
              >
                {isEnding ? "Ending..." : "End Campaign"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canWithdraw || isWithdrawing}
                onClick={() => handleAdminAction("withdraw")}
              >
                {isWithdrawing ? "Withdrawing..." : "Withdraw Funds"}
              </Button>
            </div>
          )}
          {isOwner && campaign.fundsWithdrawn && (
            <p className="text-xs text-muted-foreground ml-auto p-0.5 border-[1.5px] rounded-sm">
              💸 Funds withdrawn
            </p>
          )}
        </CardFooter>
      </Card>

      {(transactionPointer || isTransactionInProgress || transactionError) &&
        (isContributingSecret ? (
          <StepTransactionDialog
            transactionResult={{
              isLoading: isTransactionInProgress || transactionStatus.isLoading,
              isSuccess:
                !transactionError &&
                !secretSteps?.some((s) => s.status === "error") &&
                transactionStatus.isSuccess,
              isError:
                !!transactionError ||
                !!secretSteps?.find((s) => s.status === "error") ||
                transactionStatus.isError,
              error: transactionError || transactionStatus.error,
              transactionPointer,
              steps: secretSteps,
            }}
            campaignId={campaignId}
            onClose={handleTransactionComplete}
          />
        ) : (
          <TransactionDialog
            transactionResult={{
              isLoading: isTransactionInProgress || transactionStatus.isLoading,
              isSuccess: transactionStatus.isSuccess,
              isError: !!transactionError || transactionStatus.isError,
              error: transactionError || transactionStatus.error,
              transactionPointer,
            }}
            campaignId={campaignId}
            onClose={handleTransactionComplete}
          />
        ))}

      {adminAction && (
        <TransactionDialog
          transactionResult={{
            isLoading:
              (adminAction === "end" ? isEnding : isWithdrawing) &&
              !adminTxnResult,
            isSuccess: !!adminTxnResult && !("error" in adminTxnResult),
            isError: !!adminTxnResult && "error" in adminTxnResult,
            error:
              adminTxnResult && "error" in adminTxnResult
                ? (adminTxnResult.error as Error)
                : null,
            transactionPointer:
              adminTxnResult &&
              "identifier" in adminTxnResult &&
              "destinationShardId" in adminTxnResult
                ? {
                    identifier: adminTxnResult.identifier,
                    destinationShardId: adminTxnResult.destinationShardId,
                  }
                : null,
          }}
          campaignId={campaignId}
          onClose={handleAdminDialogClose}
        />
      )}
    </div>
  );
}
