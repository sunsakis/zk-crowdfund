import NavBar from "@/components/shared/NavBar";
import { WelcomeDialog } from "@/components/shared/WelcomeDialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CrowdfundingCard } from "@/components/CampaignCard";
import { useQuery } from "@tanstack/react-query";
import {
  getCrowdfundingState,
  Crowdfunding,
} from "@/hooks/useCampaignContract";
import { cn } from "./lib/utils";
import { Loader2, SearchIcon } from "lucide-react";
import { Link } from "react-router";

function Home() {
  const [campaignId, setCampaignId] = useState<string>("");
  const [searchId, setSearchId] = useState<string | null>(null);
  const [campaignIdError, setCampaignIdError] = useState<string | null>(null);

  const EXAMPLE_CONTRACT = "03260695d27fb2266de9579092ef39ddd38261065c";

  const useExampleContract = () => {
    setCampaignId(EXAMPLE_CONTRACT);
    setCampaignIdError(null);
    setSearchId(EXAMPLE_CONTRACT);
  };

  const {
    data: campaign,
    isLoading,
    error,
  } = useQuery<Crowdfunding>({
    queryKey: ["crowdfunding", searchId],
    queryFn: () => getCrowdfundingState(searchId!),
    enabled: !!searchId,
  });

  const handleSearch = () => {
    if (!campaignId) return;
    if (campaignId.length !== 42) {
      setCampaignIdError(
        "Please enter a valid campaign ID. It is the address of the campaign contract on Partisia Blockchain."
      );
      return;
    }
    setSearchId(campaignId);
  };

  return (
    <div className="h-screen overflow-auto">
      <WelcomeDialog />
      <div className="container mx-auto max-w-[1100px]">
        <NavBar />
        <div className="flex flex-col items-center gap-2 mt-10">
          <h1 className="text-4xl tracking-tighter mb-2">
            Manage your campaign
          </h1>
          <p className="text-lg text-gray-500 mb-4">
            Powered by{" "}
            <a
              href="https://partisiablockchain.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:underline"
            >
              Partisia Blockchain
            </a>
          </p>
          <div className="w-full max-w-lg">
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 flex flex-col gap-4">
              <p className="text-base text-slate-700">
                <span className="font-semibold">
                  Enter the contract address
                </span>{" "}
                of your campaign to view and manage its details.
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    className={cn(
                      "flex-1 bg-white border-2 border-gray-200 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-purple-400",
                      campaignIdError && "border-red-500"
                    )}
                    value={campaignId}
                    onChange={(e) => {
                      setCampaignId(e.target.value);
                      setCampaignIdError(null);
                    }}
                    placeholder="e.g. 103234...abcd"
                  />
                  <Button
                    variant="outline"
                    className="bg-violet-50 hover:bg-violet-200 shadow-none"
                    onClick={handleSearch}
                    disabled={isLoading || !campaignId}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <SearchIcon className="w-4 h-4" />
                    )}
                    {isLoading ? "Searching..." : "Find campaign"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 w-fit"
                    onClick={useExampleContract}
                  >
                    👁️ View example campaign
                  </Button>
                  <Link
                    to={
                      "https://github.com/sunsakis/zk-crowdfund/blob/master/README.md#rust-setup"
                    }
                    target="_blank"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 w-fit"
                    >
                      📚 Create a campaign
                    </Button>
                  </Link>
                </div>
              </div>
              {campaignIdError && (
                <p className="text-sm text-red-500 mt-0.5 p-2 bg-red-100 rounded-md">
                  {campaignIdError}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-500 mt-0.5 p-2 bg-red-100 rounded-md">
                  Could not find campaign: {error.message}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2 ml-1">
                <span className="font-medium">Tip:</span> The campaign address
                is a 42-character string starting with{" "}
                <code className="bg-slate-100 px-1 rounded">03</code>.
              </p>
            </div>
          </div>
          {!isLoading && campaign && searchId && (
            <section className="my-8 container mx-auto max-w-[1100px] flex flex-col items-center">
              <CrowdfundingCard campaign={campaign} campaignId={searchId} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
