import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "./TransactionDialog";

export default function TransactionTest() {
  const [showDialog, setShowDialog] = useState(false);
  const [txId, setTxId] = useState("");
  const [txShard, setTxShard] = useState("");

  // Sample transaction details
  const sampleTransaction = {
    id: "a4b70d913d7bfe760db8e8e1b43df8283d79ca118c42bd88dc55487b42b91e52",
    shard: "Shard1",
  };

  const handleShowDialog = () => {
    setTxId(sampleTransaction.id);
    setTxShard(sampleTransaction.shard);
    setShowDialog(true);
  };

  return (
    <div className="flex flex-col gap-4 p-6 min-h-screen">
      <h1 className="text-2xl font-bold">Transaction Dialog Test</h1>

      <div className="flex flex-col gap-2">
        <Button onClick={handleShowDialog}>Simulate Transaction</Button>

        <div className="text-sm text-gray-600">
          <p>
            Click the button above to simulate a transaction and show the
            dialog.
          </p>
          <p>Transaction ID: {sampleTransaction.id}</p>
          <p>Shard: {sampleTransaction.shard}</p>
        </div>
      </div>

      {/* The transaction dialog will only show when showDialog is true and we have transaction details */}
      {showDialog && txId && txShard && (
        <TransactionDialog
          action="deploy"
          id={txId}
          trait="collective"
          returnPath="/collectives"
          onSuccess={(contractAddress) => {
            console.log("Transaction successful!", contractAddress);
            // In a real app, you might want to redirect or update UI state here
          }}
          onError={(error) => {
            console.error("Transaction failed:", error);
          }}
        />
      )}
    </div>
  );
}
