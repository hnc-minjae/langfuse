import { useState } from "react";
import { api } from "@/src/utils/api";
import { useHasOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { Button } from "@/src/components/ui/button";
import { PlusIcon, Trash2 } from "lucide-react";
import { Skeleton } from "@/src/components/ui/skeleton";
import { UpsertDrawableResourceDialog } from "./UpsertDrawableResourceDialog";
import { DrawablePreview } from "./DrawablePreview";

export function DrawableResourceGrid({ orgId }: { orgId: string }) {
  const [selectedLocale, setSelectedLocale] = useState<string | undefined>(
    undefined,
  );

  const hasWriteAccess = useHasOrganizationAccess({
    organizationId: orgId,
    scope: "resources:CUD",
  });

  const locales = api.drawableResources.getLocales.useQuery(
    { orgId },
    { refetchOnWindowFocus: false },
  );

  const resources = api.drawableResources.getAll.useQuery(
    {
      orgId,
      page: 0,
      limit: 100,
      localeFilter: selectedLocale,
    },
    { refetchOnWindowFocus: false },
  );

  const utils = api.useUtils();

  const deleteMutation = api.drawableResources.delete.useMutation({
    onSuccess: () => void utils.drawableResources.invalidate(),
  });

  return (
    <div className="space-y-4">
      {/* Locale tabs + Upload button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <Button
            variant={!selectedLocale ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedLocale(undefined)}
          >
            All
          </Button>
          {locales.data?.map((locale) => (
            <Button
              key={locale}
              variant={selectedLocale === locale ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedLocale(locale)}
            >
              {locale}
            </Button>
          ))}
        </div>
        {hasWriteAccess && (
          <UpsertDrawableResourceDialog orgId={orgId}>
            <Button size="sm">
              <PlusIcon className="mr-1 h-4 w-4" />
              Upload
            </Button>
          </UpsertDrawableResourceDialog>
        )}
      </div>

      {/* Grid */}
      {resources.isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : resources.data?.resources.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No drawable resources found
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {resources.data?.resources.map((resource) => (
            <div
              key={resource.id}
              className="group relative rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <DrawablePreview
                orgId={orgId}
                resourceId={resource.id}
                contentType={resource.contentType}
                filename={resource.filename}
              />
              <p
                className="mt-2 truncate text-xs font-medium"
                title={resource.filename}
              >
                {resource.filename}
              </p>
              <p className="text-xs text-muted-foreground">{resource.locale}</p>
              {hasWriteAccess && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => {
                    if (confirm(`Delete "${resource.filename}"?`)) {
                      deleteMutation.mutate({ orgId, id: resource.id });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
