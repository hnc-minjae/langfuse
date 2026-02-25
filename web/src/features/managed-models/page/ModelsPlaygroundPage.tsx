import React, { useCallback } from "react";
import { Button } from "@/src/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import Page from "@/src/components/layouts/page";
import {
  PlaygroundProvider,
  usePlaygroundContext,
} from "@/src/features/playground/page/context";
import { ModelParameters } from "@/src/components/ModelParameters";
import { Messages } from "@/src/features/playground/page/components/Messages";
import { ConfigurationDropdowns } from "@/src/features/playground/page/components/ConfigurationDropdowns";
import { NoModelConfiguredAlert } from "@/src/features/playground/page/components/NoModelConfiguredAlert";
import { ModelQuickSelect } from "../components/ModelQuickSelect";
import useCommandEnter from "@/src/features/playground/page/hooks/useCommandEnter";

const WINDOW_ID = "models-playground";

export function ModelsPlaygroundPage({ projectId }: { projectId: string }) {
  return (
    <PlaygroundProvider windowId={WINDOW_ID}>
      <ModelsPlaygroundContent projectId={projectId} />
    </PlaygroundProvider>
  );
}

function ModelsPlaygroundContent({ projectId }: { projectId: string }) {
  const playground = usePlaygroundContext();
  const {
    handleSubmit,
    isStreaming,
    availableProviders,
    updateModelParamValue,
    modelParams,
  } = playground;

  const hasModelConfigured = availableProviders.length > 0;

  const handleRun = useCallback(() => {
    void handleSubmit(true);
  }, [handleSubmit]);

  useCommandEnter(!isStreaming, async () => {
    await handleSubmit(true);
  });

  const handleQuickSelect = useCallback(
    (params: { brand: string; modelId: string }) => {
      updateModelParamValue("provider", params.brand);
      updateModelParamValue("model", params.modelId);
    },
    [updateModelParamValue],
  );

  return (
    <Page
      scrollable={false}
      withPadding={false}
      headerProps={{
        title: "Models Playground",
        help: {
          description:
            "Test your managed models with a single-window playground. Select a model and start chatting.",
        },
        actionButtonsRight: (
          <div className="flex flex-nowrap items-center gap-2">
            <ModelQuickSelect
              projectId={projectId}
              onSelectModel={handleQuickSelect}
              currentModelId={
                modelParams.model.value
                  ? String(modelParams.model.value)
                  : undefined
              }
            />
            <Button
              onClick={handleRun}
              disabled={isStreaming || !hasModelConfigured}
              className="flex-shrink-0 gap-1"
              title={
                !hasModelConfigured
                  ? "Please configure a model in Project Settings first"
                  : "Run (Ctrl + Enter)"
              }
            >
              {isStreaming ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">Run</span>
            </Button>
          </div>
        ),
      }}
    >
      <div className="flex h-full flex-col">
        {!hasModelConfigured && (
          <NoModelConfiguredAlert projectId={projectId} />
        )}
        <div className="flex-1 overflow-hidden p-4">
          <div className="flex h-full flex-col rounded-lg border bg-background shadow-sm">
            {/* Model Parameters Header */}
            <div className="flex-shrink-0 border-b bg-muted/50 px-3 py-1">
              <div className="flex items-center gap-2">
                <ModelParameters {...playground} layout="compact" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <div className="flex h-full flex-col">
                <ConfigurationDropdowns />
                <div className="flex-1 overflow-auto p-4">
                  <Messages {...playground} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
