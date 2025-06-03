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
} from "@/hooks/useCampaignContract";
import { ExternalLinkIcon } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { TransactionDialog } from "@/components/shared/TransactionDialog";
import { TransactionPointer } from "@/hooks/useCampaignTransaction";
import { useTransactionStatus } from "@/hooks/useTransactionStatus";

interface CrowdfundingCardProps {
  campaign: Crowdfunding;
  campaignId: string;
}

// Helper functions for token unit conversion
function tokenUnitsToDisplayAmount(tokenUnits: number): number {
  return tokenUnits / 1_000_000;
}

export function CrowdfundingCard({
  campaign,
  campaignId,
}: CrowdfundingCardProps) {
  const [amount, setAmount] = useState<string>("");
  const { mutateAsync: contribute, isPending: isContributing } =
    useContribute();
  const { mutateAsync: contributeSecret, isPending: isContributingSecret } =
    useContributeSecret();
  const [amountInputError, setAmountInputError] = useState<string | null>(null);
  const { account } = useAuth();
  const [transactionPointer, setTransactionPointer] =
    useState<TransactionPointer | null>(null);
  const transactionStatus = useTransactionStatus(
    transactionPointer?.identifier ?? "",
    "other"
  );

  const isTotalRevealed =
    campaign.totalRaised !== undefined &&
    campaign.totalRaised >= campaign.fundingTarget;

  const progress =
    campaign.totalRaised !== undefined
      ? Math.min(
          100,
          ((campaign.totalRaised ?? 0) / campaign.fundingTarget) * 100
        )
      : 0;

  const handleContribute = async (isSecret: boolean) => {
    if (!account) {
      setAmountInputError("Please connect your wallet");
      return;
    }

    if (amount === "") {
      setAmountInputError("Please enter an amount");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setAmountInputError("Please enter a valid amount");
      return;
    }

    // Convert display amount to raw token units (1_000_000 = 1 token)
    const rawAmount = Math.round(amountNum * 1_000_000);

    try {
      const params = {
        crowdfundingAddress: campaignId,
        amount: rawAmount,
        tokenAddress: campaign.tokenAddress.asString(),
      };

      const result = isSecret
        ? await contributeSecret(params)
        : await contribute(params);

      if (result) {
        setTransactionPointer(result);
        setAmount("");
        setAmountInputError(null);
      }
    } catch (error) {
      console.error("Contribution error:", error);
      setAmountInputError(
        error instanceof Error ? error.message : "Transaction failed"
      );
    }
  };

  const handleTransactionComplete = () => {
    setTransactionPointer(null);
  };

  const getStatusText = (status: Crowdfunding["status"]) => {
    switch (status.discriminant) {
      case CampaignStatusD.Active:
        return "Active";
      case CampaignStatusD.Computing:
        return "Computing";
      case CampaignStatusD.Completed:
        return "Completed";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="pb-1 px-1 bg-violet-100 rounded-xl">
      <div className="py-1 pl-2">
        <code className="uppercase text-xs font-mono text-violet-600 tracking-wide">
          {campaign.shardId} ♦️ {campaignId}
        </code>
      </div>
      <Card className="w-full max-w-2xl shadow-none border-none mt-1">
        <CardHeader>
          <CardTitle className="text-xl font-bold">{campaign.title}</CardTitle>
          <CardDescription>{campaign.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-5 text-sm">
            <div>
              <p className="text-muted-foreground">Total Raised</p>
              {isTotalRevealed ? (
                <p className="text-lg font-medium">
                  {tokenUnitsToDisplayAmount(campaign.totalRaised ?? 0).toFixed(
                    6
                  )}{" "}
                  tokens
                </p>
              ) : (
                <p className="text-sm bg-neutral-100 text-neutral-500 px-2 py-1 rounded-sm w-fit">
                  Revealed when threshold is met
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

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount to give"
                className={`flex-1 rounded-md border px-3 py-2 ${
                  amountInputError ? "border-red-500" : ""
                }`}
                min="0.000001"
                max="2147.483647"
                step="0.000001"
              />
              <Button
                className="bg-violet-800 hover:bg-violet-600 shadow-none"
                onClick={() => handleContribute(true)}
                disabled={isContributing || isContributingSecret}
              >
                Contribute secretly
              </Button>
            </div>
            {amountInputError && (
              <p className="text-xs text-red-500">{amountInputError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Last updated: {new Date(campaign.lastUpdated).toLocaleString()}
            </p>
          </div>
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
        </CardFooter>
      </Card>

      {transactionPointer && (
        <TransactionDialog
          transactionResult={{
            isLoading: transactionStatus.isLoading,
            isSuccess: transactionStatus.isSuccess,
            isError: transactionStatus.isError,
            error: transactionStatus.error,
            transactionPointer,
          }}
          campaignId={campaignId}
          onClose={handleTransactionComplete}
        />
      )}
    </div>
  );
}
