import NavBar from "@/components/shared/NavBar";
import { WelcomeDialog } from "./components/shared/WelcomeDialog";
import { useState } from "react";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { CrowdfundingCard } from "./components/CampaignCard";
import { useQuery } from "@tanstack/react-query";
import {
  getCrowdfundingState,
  Crowdfunding,
} from "@/hooks/useCampaignContract";
import { cn } from "./lib/utils";
import { Loader2, SearchIcon } from "lucide-react";

function Home() {
  // 038e9300750a82ec9c4006f8ee634f08d0bc36c8ba
  const [campaignId, setCampaignId] = useState<string>("");
  const [searchId, setSearchId] = useState<string | null>(null);
  const [campaignIdError, setCampaignIdError] = useState<string | null>(null);

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
              <div className="flex gap-2">
                <Input
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
                  {isLoading ? "Loading..." : "Find Campaign"}
                </Button>
              </div>
              {campaignIdError && (
                <p className="text-sm text-red-500 mt-0.5 p-2 bg-red-100 rounded-md">
                  {campaignIdError}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-500 mt-0.5 p-2 bg-red-100 rounded-md">
                  Error loading campaign: {error.message}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2">
                <span className="font-medium">Tip:</span> The campaign address
                is a 42-character string starting with{" "}
                <code className="bg-slate-100 px-1 rounded">03</code>.
              </p>
            </div>
          </div>
          {!isLoading && campaign && searchId && (
            <section className="mt-8 container mx-auto max-w-[1100px] flex flex-col items-center">
              <CrowdfundingCard campaign={campaign} campaignId={searchId} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
