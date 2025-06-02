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
  const { mutate: contribute, isPending: isContributing } = useContribute();
  const { mutate: contributeSecret, isPending: isContributingSecret } =
    useContributeSecret();

  const isTargetRevealed =
    campaign.totalRaised !== undefined &&
    campaign.totalRaised >= campaign.fundingTarget;

  const progress = campaign.totalRaised
    ? Math.min(100, (campaign.totalRaised / campaign.fundingTarget) * 100)
    : 0;

  const handleContribute = (isSecret: boolean) => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    // Convert display amount to raw token units (1_000_000 = 1 token)
    const rawAmount = Math.round(amountNum * 1_000_000);

    if (isSecret) {
      contributeSecret({ crowdfundingAddress: campaignId, amount: rawAmount });
    } else {
      contribute({ crowdfundingAddress: campaignId, amount: rawAmount });
    }
    setAmount("");
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

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Raised</p>
              <p className="text-lg font-medium">
                {campaign.totalRaised !== undefined
                  ? `${tokenUnitsToDisplayAmount(campaign.totalRaised).toFixed(6)} tokens`
                  : "0 tokens"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Funding Target</p>
              <p className="text-lg font-medium">
                {isTargetRevealed
                  ? `${tokenUnitsToDisplayAmount(campaign.fundingTarget).toFixed(6)} tokens`
                  : "???"}
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
                placeholder="Amount to contribute"
                className="flex-1 rounded-md border px-3 py-2"
                min="0"
                step="0.000001"
              />
              <Button
                className="bg-violet-800 hover:bg-violet-600 shadow-none"
                onClick={() => handleContribute(false)}
                disabled={isContributing || isContributingSecret}
              >
                Contribute
              </Button>
              <Button
                onClick={() => handleContribute(true)}
                variant="outline"
                disabled={isContributing || isContributingSecret}
              >
                Contribute Secretly
              </Button>
            </div>
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
    </div>
  );
}
