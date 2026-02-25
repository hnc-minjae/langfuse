import Page from "@/src/components/layouts/page";
import { ManagedModelTable } from "../components/ManagedModelTable";

export function ModelsPage({ projectId }: { projectId: string }) {
  return (
    <Page
      scrollable
      headerProps={{
        title: "Models",
        help: {
          description:
            "Manage model metadata for your project. Track supported models, token limits, and capabilities.",
        },
      }}
    >
      <ManagedModelTable projectId={projectId} />
    </Page>
  );
}
