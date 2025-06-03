import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("hasSeenGivtisiaWelcome");
    if (!hasSeenWelcome) {
      setOpen(true);
      localStorage.setItem("hasSeenGivtisiaWelcome", "true");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[480px] border-2 border-black rounded-lg p-0 overflow-hidden transition-all duration-300 shadow-xl">
        <DialogHeader className="border-b border-gray-200 p-4">
          <DialogTitle className="text-xl font-bold">
            Welcome to Givtisia! 🫴🏽
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center pb-6 px-5 space-y-6 pt-4">
          <div className="flex flex-col items-center space-y-4 w-full">
            <p className="text-lg">
              Manage your crowdfunding campaign on{" "}
              <Link
                to="https://partisiablockchain.com"
                target="_blank"
                className="text-violet-600 font-medium hover:underline"
              >
                Partisia Blockchain
              </Link>
            </p>

            <div className="w-full bg-violet-50 p-4 rounded-md border border-violet-200">
              <div className="flex items-start gap-3">
                <div>
                  <h4 className="font-medium text-violet-900">
                    🔑 Required Extension
                  </h4>
                  <p className="text-sm text-violet-800 mt-1">
                    You'll need the{" "}
                    <a
                      href="https://chromewebstore.google.com/detail/parti-wallet/gjkdbeaiifkpoencioahhcilildpjhgh"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 hover:underline font-medium"
                    >
                      Parti Wallet extension
                    </a>{" "}
                    for Chrome or Brave browsers to perform on-chain
                    transactions.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-neutral-100 p-4 rounded-md border border-neutral-300">
              <h3 className="font-medium">🙈 Privacy & Security Features</h3>
              <ul className="flex flex-col gap-2 text-sm mt-2">
                <li>
                  <strong>Multiple Wallet Options:</strong> Connect using
                  private key, MPC wallet extension, or MetaMask with Partisia
                  snap
                </li>
                <li>
                  <strong>Confidential Contributions:</strong> Individual
                  contribution amounts remain completely private
                </li>
                <li>
                  <strong>Threshold-Based Revelation:</strong> Total funds are
                  only revealed if the campaign reaches its goal
                </li>
                <li>
                  <strong>Zero-Knowledge Verification:</strong> Contributors can
                  verify their participation without revealing amounts
                </li>
                <li>
                  <strong>Secure Multi-Party Computation:</strong> Contributions
                  are aggregated using cryptographic protocols that preserve
                  privacy
                </li>
              </ul>
            </div>

            <div className="w-full flex items-center justify-between mt-1 p-2 bg-gray-50 rounded-md border border-gray-200">
              <span className="text-sm text-gray-600">Found a bug?</span>
              <a
                href="https://github.com/sunsakis/zk-crowdfund/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-medium text-violet-600 hover:text-violet-800"
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
