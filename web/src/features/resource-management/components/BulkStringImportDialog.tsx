import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { api } from "@/src/utils/api";

export function BulkStringImportDialog({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [jsonStr, setJsonStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const utils = api.useUtils();

  const bulkMutation = api.stringResources.bulkUpsert.useMutation({
    onSuccess: (data) => {
      setResult(`Successfully imported ${data.count} string resources`);
      void utils.stringResources.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const handleImport = () => {
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) {
        setError(
          "JSON must be an array of {category, key, locale, value} objects",
        );
        return;
      }
      bulkMutation.mutate({ orgId, resources: parsed });
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setError(null);
          setResult(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import String Resources</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>JSON Array</Label>
            <Textarea
              value={jsonStr}
              onChange={(e) => setJsonStr(e.target.value)}
              rows={12}
              className="font-mono text-xs"
              placeholder={
                '[\n  {"category": "menu", "key": "home", "locale": "en-US", "value": "Home"},\n  ...\n]'
              }
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && <p className="text-sm text-green-600">{result}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={handleImport} disabled={bulkMutation.isPending}>
              {bulkMutation.isPending ? "Importing..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
