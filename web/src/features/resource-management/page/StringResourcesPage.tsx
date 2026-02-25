import Page from "@/src/components/layouts/page";
import { StringResourceTable } from "../components/StringResourceTable";

export function StringResourcesPage({ orgId }: { orgId: string }) {
  return (
    <Page
      scrollable
      headerProps={{
        title: "String Resources",
        help: {
          description:
            "Manage i18n string resources organized by category, key, and locale.",
        },
      }}
    >
      <StringResourceTable orgId={orgId} />
    </Page>
  );
}
