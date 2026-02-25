import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { api } from "@/src/utils/api";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";

export function DeleteManagedModelButton({
  projectId,
  modelId,
  modelName,
}: {
  projectId: string;
  modelId: string;
  modelName: string;
}) {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();

  const deleteMutation = api.managedModels.delete.useMutation({
    onSuccess: () => {
      void utils.managedModels.invalidate();
      setOpen(false);
      showSuccessToast({
        title: "Model deleted",
        description: `"${modelName}" has been deleted.`,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Model</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{modelName}&quot;? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ id: modelId, projectId })}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
