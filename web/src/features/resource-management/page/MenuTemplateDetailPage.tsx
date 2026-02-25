import { useState } from "react";
import Page from "@/src/components/layouts/page";
import { api } from "@/src/utils/api";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { useHasOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { PlusIcon, Trash2 } from "lucide-react";
import { UpsertMenuTemplateDialog } from "../components/UpsertMenuTemplateDialog";
import { Skeleton } from "@/src/components/ui/skeleton";

export function MenuTemplateDetailPage({
  orgId,
  product,
}: {
  orgId: string;
  product: string;
}) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );

  const hasWriteAccess = useHasOrganizationAccess({
    organizationId: orgId,
    scope: "resources:CUD",
  });

  const versions = api.menuTemplates.getVersions.useQuery(
    { orgId, product, page: 0, limit: 100 },
    { refetchOnWindowFocus: false },
  );

  const selectedId = selectedVersionId ?? versions.data?.versions[0]?.id;

  const detail = api.menuTemplates.getById.useQuery(
    { orgId, id: selectedId! },
    { enabled: !!selectedId, refetchOnWindowFocus: false },
  );

  const utils = api.useUtils();

  const deleteMutation = api.menuTemplates.delete.useMutation({
    onSuccess: () => {
      void utils.menuTemplates.getVersions.invalidate();
      setSelectedVersionId(null);
    },
  });

  return (
    <Page
      scrollable
      headerProps={{
        title: `Menu Template: ${product}`,
        breadcrumb: [
          {
            name: "Menu Templates",
            href: `/organization/${orgId}/resources/menu-templates`,
          },
        ],
        actionButtonsRight: hasWriteAccess ? (
          <UpsertMenuTemplateDialog
            orgId={orgId}
            product={product}
            onSuccess={() => void utils.menuTemplates.getVersions.invalidate()}
          >
            <Button size="sm">
              <PlusIcon className="mr-1 h-4 w-4" />
              New Version
            </Button>
          </UpsertMenuTemplateDialog>
        ) : null,
      }}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Version history sidebar */}
        <div className="lg:col-span-1">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Versions
          </h3>
          <div className="space-y-1">
            {versions.isPending
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              : versions.data?.versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersionId(v.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === v.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">v{v.version}</span>
                      <div className="flex gap-1">
                        {v.labels.map((label) => (
                          <Badge
                            key={label}
                            variant="outline"
                            className="text-xs"
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {v.commitMessage && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {v.commitMessage}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
          </div>
        </div>

        {/* JSON viewer */}
        <div className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              Content {detail.data ? `(v${detail.data.version})` : ""}
            </h3>
            {hasWriteAccess && selectedId && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  if (
                    confirm("Are you sure you want to delete this version?")
                  ) {
                    deleteMutation.mutate({ orgId, id: selectedId });
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete Version
              </Button>
            )}
          </div>
          {detail.isPending ? (
            <Skeleton className="h-96 w-full" />
          ) : detail.data ? (
            <pre className="max-h-[70vh] overflow-auto rounded-md border bg-muted/50 p-4 text-xs">
              {JSON.stringify(detail.data.content, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a version to view content
            </p>
          )}
        </div>
      </div>
    </Page>
  );
}
