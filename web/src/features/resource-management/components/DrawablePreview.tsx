import { api } from "@/src/utils/api";
import { Skeleton } from "@/src/components/ui/skeleton";

export function DrawablePreview({
  orgId,
  resourceId,
  contentType,
  filename,
}: {
  orgId: string;
  resourceId: string;
  contentType: string;
  filename: string;
}) {
  const detail = api.drawableResources.getById.useQuery(
    { orgId, id: resourceId },
    { refetchOnWindowFocus: false },
  );

  if (detail.isPending) {
    return <Skeleton className="aspect-square w-full" />;
  }

  if (!detail.data) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">
        N/A
      </div>
    );
  }

  const { content } = detail.data;

  if (contentType === "image/svg+xml") {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center rounded bg-muted/30 p-2"
        dangerouslySetInnerHTML={{ __html: atob(content) }}
      />
    );
  }

  return (
    <img
      src={`data:${contentType};base64,${content}`}
      alt={filename}
      className="aspect-square w-full rounded bg-muted/30 object-contain"
    />
  );
}
