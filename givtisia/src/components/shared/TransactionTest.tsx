import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "./TransactionDialog";
import { useTransactionStatus } from "@/hooks/useTransactionStatus";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SHARD_PRIORITY, ShardId } from "@/partisia-config";

export default function TransactionTest() {
  const [showDialog, setShowDialog] = useState(false);
  const [txId, setTxId] = useState("");
  const [selectedShard, setSelectedShard] = useState<ShardId>(
    SHARD_PRIORITY[0]
  );

  // Sample transaction for quick testing
  const sampleTransaction = {
    id: "6f76e0fa11d32929508f892b7851485137be2ffe4d104dfe332d4fd3b7d236f5",
    shard: "Shard2" as ShardId,
  };

  const status = useTransactionStatus(txId);

  const handleShowDialog = () => {
    if (!txId) {
      setTxId(sampleTransaction.id);
      setSelectedShard(sampleTransaction.shard);
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setTxId("");
    setSelectedShard(SHARD_PRIORITY[0]);
  };

  return (
    <div className="flex flex-col gap-4 p-6 min-h-screen">
      <h1 className="text-2xl font-bold">Transaction Status Test</h1>

      <div className="flex flex-col gap-4 max-w-md">
        <div className="space-y-2">
          <label className="text-sm font-medium">Transaction ID</label>
          <Input
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            placeholder="Enter transaction ID"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Shard</label>
          <Select
            value={selectedShard}
            onValueChange={(value: ShardId) => setSelectedShard(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHARD_PRIORITY.map((shard) => (
                <SelectItem key={shard} value={shard}>
                  {shard}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleShowDialog}
            disabled={!txId}
            className="flex-1"
          >
            Check Transaction
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setTxId(sampleTransaction.id);
              setSelectedShard(sampleTransaction.shard);
            }}
          >
            Use Sample
          </Button>
        </div>

        {status && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-medium mb-2">Status:</h3>
            <div className="space-y-1 text-sm">
              <p>Loading: {status.isLoading ? "Yes" : "No"}</p>
              <p>Success: {status.isSuccess ? "Yes" : "No"}</p>
              <p>Error: {status.isError ? "Yes" : "No"}</p>
              <p>Finalized: {status.isFinalized ? "Yes" : "No"}</p>
              {status.error && (
                <p className="text-red-600">Error: {status.error.message}</p>
              )}
              {status.eventChain.length > 0 && (
                <p>Event Chain Length: {status.eventChain.length}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {showDialog && txId && (
        <TransactionDialog
          transactionResult={{
            transactionPointer: {
              identifier: txId,
              destinationShardId: selectedShard,
            },
            isLoading: status?.isLoading ?? true,
            isSuccess: status?.isSuccess ?? false,
            isError: status?.isError ?? false,
            error: status?.error ?? null,
          }}
          campaignId=""
          status={status}
          onClose={handleCloseDialog}
        />
      )}
    </div>
  );
}
