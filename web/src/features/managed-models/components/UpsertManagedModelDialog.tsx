import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type z } from "zod/v4";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
  DialogFooter,
} from "@/src/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Switch } from "@/src/components/ui/switch";
import { Button } from "@/src/components/ui/button";
import { api } from "@/src/utils/api";
import { showSuccessToast } from "@/src/features/notifications/showSuccessToast";
import { ManagedModelInput } from "../validation";

type ManagedModelFormValues = z.infer<typeof ManagedModelInput>;

interface UpsertManagedModelDialogProps {
  projectId: string;
  existingModel?: {
    id: string;
    modelId: string;
    displayName: string;
    brand: string;
    brandDisplayName: string;
    maxInputTokenSize: number | null;
    maxOutputTokenSize: number | null;
    contextWindowSize: number | null;
    isSupported: boolean;
    sortOrder: number;
    capabilities: unknown;
    baseUrl: string | null;
    modelName: string | null;
    displayApiToken: string | null;
    timeout: number | null;
  };
  children: React.ReactNode;
}

export function UpsertManagedModelDialog({
  projectId,
  existingModel,
  children,
}: UpsertManagedModelDialogProps) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const utils = api.useUtils();
  const isEdit = !!existingModel;

  const form = useForm<ManagedModelFormValues>({
    resolver: zodResolver(ManagedModelInput),
    defaultValues: {
      modelId: existingModel?.modelId ?? "",
      displayName: existingModel?.displayName ?? "",
      brand: existingModel?.brand ?? "",
      brandDisplayName: existingModel?.brandDisplayName ?? "",
      maxInputTokenSize: existingModel?.maxInputTokenSize ?? undefined,
      maxOutputTokenSize: existingModel?.maxOutputTokenSize ?? undefined,
      contextWindowSize: existingModel?.contextWindowSize ?? undefined,
      isSupported: existingModel?.isSupported ?? true,
      sortOrder: existingModel?.sortOrder ?? 0,
      baseUrl: existingModel?.baseUrl ?? undefined,
      modelName: existingModel?.modelName ?? undefined,
      apiToken: undefined,
      timeout: existingModel?.timeout ?? undefined,
    },
  });

  const createMutation = api.managedModels.create.useMutation({
    onSuccess: () => {
      void utils.managedModels.invalidate();
      form.reset();
      setOpen(false);
      showSuccessToast({
        title: "Model created",
        description: "The managed model has been created successfully.",
      });
    },
    onError: (error) => setFormError(error.message),
  });

  const updateMutation = api.managedModels.update.useMutation({
    onSuccess: () => {
      void utils.managedModels.invalidate();
      form.reset();
      setOpen(false);
      showSuccessToast({
        title: "Model updated",
        description: "The managed model has been updated successfully.",
      });
    },
    onError: (error) => setFormError(error.message),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: ManagedModelFormValues) {
    setFormError(null);
    if (isEdit && existingModel) {
      updateMutation.mutate({
        id: existingModel.id,
        projectId,
        ...values,
      });
    } else {
      createMutation.mutate({
        projectId,
        ...values,
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) {
          form.reset();
          setFormError(null);
        }
        setOpen(newOpen);
      }}
    >
      <DialogTrigger asChild onClick={() => setOpen(true)}>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Model" : "Add Model"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="modelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model ID</FormLabel>
                      <FormControl>
                        <Input placeholder="gpt-4o" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="GPT-4o" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="openai" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="brandDisplayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="OpenAI" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="maxInputTokenSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Input Tokens</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="128000"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxOutputTokenSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Output Tokens</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="16384"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contextWindowSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Context Window</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="128000"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium text-muted-foreground">
                  LLM Connection
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="baseUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Base URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://api.openai.com/v1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="modelName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model Name (API)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="gpt-4o-2024-08-06"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="apiToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          API Token
                          {isEdit && existingModel?.displayApiToken && (
                            <span className="ml-2 font-normal text-muted-foreground">
                              ({existingModel.displayApiToken})
                            </span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder={
                              isEdit ? "Leave empty to keep current" : "sk-..."
                            }
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timeout (seconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="120"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isSupported"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <FormLabel>Supported</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isPending}>
                {isEdit ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
          {formError && (
            <p className="my-2 text-center text-sm font-medium text-destructive">
              <span className="font-semibold">Error:</span> {formError}
            </p>
          )}
        </Form>
      </DialogContent>
    </Dialog>
  );
}
