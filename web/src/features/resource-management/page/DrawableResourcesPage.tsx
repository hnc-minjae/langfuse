import Page from "@/src/components/layouts/page";
import { DrawableResourceGrid } from "../components/DrawableResourceGrid";

export function DrawableResourcesPage({ orgId }: { orgId: string }) {
  return (
    <Page
      scrollable
      headerProps={{
        title: "Drawable Resources",
        help: {
          description:
            "Manage image resources (SVG icons, JPG thumbnails) organized by locale.",
        },
      }}
    >
      <DrawableResourceGrid orgId={orgId} />
    </Page>
  );
}
