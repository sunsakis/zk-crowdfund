import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router";

export function WelcomeDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("hasSeenCampfireWelcome");
    if (!hasSeenWelcome) {
      setOpen(true);
      localStorage.setItem("hasSeenCampfireWelcome", "true");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[480px] border-2 border-black rounded-lg p-0 overflow-hidden transition-all duration-300 shadow-xl">
        <DialogHeader className="border-b border-gray-200 p-4">
          <DialogTitle className="text-xl font-bold">
            Welcome to Campfire! 🎉
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center pb-6 px-5 space-y-6 pt-4">
          <div className="flex flex-col items-center space-y-4 w-full">
            <p className="text-lg">
              Create private ballots/polls for your decentralized organization,
              powered by{" "}
              <Link
                to="https://partisiablockchain.com"
                target="_blank"
                className="text-blue-600 font-medium hover:underline"
              >
                Partisia Blockchain
              </Link>
            </p>

            <div className="w-full bg-blue-50 p-4 rounded-md border border-blue-200">
              <div className="flex items-start gap-3">
                <div>
                  <h4 className="font-medium text-blue-900">
                    🔑 Required Extension
                  </h4>
                  <p className="text-sm text-blue-800 mt-1">
                    You'll need the{" "}
                    <a
                      href="https://chromewebstore.google.com/detail/parti-wallet/gjkdbeaiifkpoencioahhcilildpjhgh"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Parti Wallet extension
                    </a>{" "}
                    for Chrome or Brave browsers to perform on-chain
                    transactions.
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full bg-amber-50 p-4 rounded-md border border-amber-200">
              <div className="flex items-start gap-3">
                <div>
                  <h4 className="font-medium text-amber-900">🪲 Known Bug</h4>
                  <p className="text-sm text-amber-800 mt-1">
                    The wallet may disconnect randomly and when the page
                    refreshes. We're working on a fix. If you encounter any
                    other issues, please report them on our GitHub.
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full flex items-center justify-between mt-1 p-2 bg-gray-50 rounded-md border border-gray-200">
              <span className="text-sm text-gray-600">Found a bug?</span>
              <a
                href="https://github.com/thebeyondr/sekiva/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Report Issue <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </div>
          </div>

          <Button
            variant="default"
            onClick={() => setOpen(false)}
            className="w-full py-5 bg-black hover:bg-stone-800 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
          >
            Get Started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
