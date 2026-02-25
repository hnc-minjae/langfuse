import Page from "@/src/components/layouts/page";
import { MenuTemplateTable } from "../components/MenuTemplateTable";

export function MenuTemplatesPage({ orgId }: { orgId: string }) {
  return (
    <Page
      scrollable
      headerProps={{
        title: "Menu Templates",
        help: {
          description:
            "Manage versioned menu templates for different products. Each product has multiple versions with JSON content.",
        },
      }}
    >
      <MenuTemplateTable orgId={orgId} />
    </Page>
  );
}
