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
import { api } from "@/src/utils/api";

export function UpsertDrawableResourceDialog({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState("");
  const [locale, setLocale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileData, setFileData] = useState<{
    content: string;
    contentType: string;
  } | null>(null);

  const utils = api.useUtils();

  const createMutation = api.drawableResources.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      resetForm();
      void utils.drawableResources.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const resetForm = () => {
    setFilename("");
    setLocale("");
    setError(null);
    setPreview(null);
    setFileData(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:image/svg+xml;base64,..."
      const base64 = result.split(",")[1] ?? "";
      setFileData({ content: base64, contentType: file.type });
      setPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    setError(null);
    if (!fileData) {
      setError("Please select a file");
      return;
    }
    createMutation.mutate({
      orgId,
      filename,
      locale,
      contentType: fileData.contentType,
      content: fileData.content,
    });
  };

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
          <DialogTitle>Upload Drawable Resource</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>File</Label>
            <Input
              type="file"
              accept="image/svg+xml,image/jpeg,image/png"
              onChange={handleFileChange}
            />
          </div>
          {preview && (
            <div className="flex justify-center">
              <img
                src={preview}
                alt="Preview"
                className="h-24 w-24 rounded bg-muted object-contain"
              />
            </div>
          )}
          <div>
            <Label>Filename</Label>
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g. menu_icon_general_draft.svg"
            />
          </div>
          <div>
            <Label>Locale</Label>
            <Input
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="e.g. en-US, ko-KR"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || !filename || !locale}
            >
              {createMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
