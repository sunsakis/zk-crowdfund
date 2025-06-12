import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Key } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

type AuthMethod = "mpc" | "privateKey";

// Validate private key format (64 character hex string)
const isValidPrivateKey = (privateKey: string): boolean => {
  const cleanKey = privateKey.trim();
  const hexRegex = /^[0-9a-fA-F]{64}$/;
  return hexRegex.test(cleanKey);
};

export function AuthMethodDialog({
  open,
  onClose,
  onAuthMethodSelect,
}: {
  open: boolean;
  onClose: () => void;
  onAuthMethodSelect: (method: AuthMethod, privateKey?: string) => void;
}) {
  const [showPrivateKeyInput, setShowPrivateKeyInput] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [privateKeyError, setPrivateKeyError] = useState("");

  const handlePrivateKeyChange = (value: string) => {
    setPrivateKey(value);
    if (value && !isValidPrivateKey(value)) {
      setPrivateKeyError("Private key must be a 64-character string");
    } else {
      setPrivateKeyError("");
    }
  };

  const handlePrivateKeyConnect = () => {
    if (isValidPrivateKey(privateKey)) {
      onAuthMethodSelect("privateKey", privateKey);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {showPrivateKeyInput
              ? "Enter private key"
              : "Choose sign in method"}
          </DialogTitle>
          {!showPrivateKeyInput && (
            <DialogDescription>
              Choose how you want to sign in.
            </DialogDescription>
          )}
        </DialogHeader>

        {!showPrivateKeyInput ? (
          <div className="flex flex-col gap-4">
            <Button
              onClick={() => onAuthMethodSelect("mpc")}
              className="flex items-center gap-2"
            >
              <Wallet size={16} />
              Connect with MPC Wallet
            </Button>
            <Button
              onClick={() => setShowPrivateKeyInput(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Key size={16} />
              Use Private Key
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Input
              type="password"
              placeholder="Enter private key (64-character hex)"
              value={privateKey}
              onChange={(e) => handlePrivateKeyChange(e.target.value)}
              className={privateKeyError ? "border-red-500" : ""}
            />
            {privateKeyError && (
              <p className="text-sm text-red-500">{privateKeyError}</p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handlePrivateKeyConnect}
                disabled={!privateKey || !isValidPrivateKey(privateKey)}
              >
                Connect
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPrivateKeyInput(false);
                  setPrivateKey("");
                  setPrivateKeyError("");
                }}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
