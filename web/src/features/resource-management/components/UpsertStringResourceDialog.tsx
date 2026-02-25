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

export function UpsertStringResourceDialog({
  orgId,
  existingResource,
  children,
}: {
  orgId: string;
  existingResource?: {
    id: string;
    category: string;
    key: string;
    locale: string;
    value: string;
  };
  children: ReactNode;
}) {
  const isEdit = !!existingResource;
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(existingResource?.category ?? "");
  const [key, setKey] = useState(existingResource?.key ?? "");
  const [locale, setLocale] = useState(existingResource?.locale ?? "");
  const [value, setValue] = useState(existingResource?.value ?? "");
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();

  const createMutation = api.stringResources.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      resetForm();
      void utils.stringResources.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = api.stringResources.update.useMutation({
    onSuccess: () => {
      setOpen(false);
      void utils.stringResources.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const resetForm = () => {
    if (!existingResource) {
      setCategory("");
      setKey("");
      setLocale("");
      setValue("");
    }
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    if (isEdit) {
      updateMutation.mutate({ orgId, id: existingResource.id, value });
    } else {
      createMutation.mutate({ orgId, category, key, locale, value });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit String Resource" : "Add String Resource"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Category</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isEdit}
              placeholder="e.g. menu, label, template"
            />
          </div>
          <div>
            <Label>Key</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={isEdit}
              placeholder="e.g. generate, draft"
            />
          </div>
          <div>
            <Label>Locale</Label>
            <Input
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              disabled={isEdit}
              placeholder="e.g. en-US, ko-KR"
            />
          </div>
          <div>
            <Label>Value</Label>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={4}
              placeholder="String value..."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
