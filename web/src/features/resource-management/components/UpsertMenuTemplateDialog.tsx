import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { api } from "@/src/utils/api";

export function UpsertMenuTemplateDialog({
  orgId,
  product,
  children,
  onSuccess,
}: {
  orgId: string;
  product?: string;
  children: ReactNode;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState(product ?? "");
  const [contentStr, setContentStr] = useState("{}");
  const [commitMessage, setCommitMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();

  const createMutation = api.menuTemplates.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setContentStr("{}");
      setCommitMessage("");
      setError(null);
      void utils.menuTemplates.invalidate();
      onSuccess?.();
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = () => {
    try {
      const content = JSON.parse(contentStr);
      setError(null);
      createMutation.mutate({
        orgId,
        product: productName,
        content,
        commitMessage: commitMessage || undefined,
      });
    } catch {
      setError("Invalid JSON content");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Version</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!product && (
            <div>
              <Label>Product</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. assistanthwp"
              />
            </div>
          )}
          <div>
            <Label>Commit Message (optional)</Label>
            <Input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe this version..."
            />
          </div>
          <div>
            <Label>Content (JSON)</Label>
            <Textarea
              value={contentStr}
              onChange={(e) => setContentStr(e.target.value)}
              rows={15}
              className="font-mono text-xs"
              placeholder='{"menuTemplates": [], "templates": []}'
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !productName}
            >
              {createMutation.isPending ? "Creating..." : "Create Version"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
