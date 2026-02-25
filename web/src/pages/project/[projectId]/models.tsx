import { useRouter } from "next/router";
import { ModelsPage } from "@/src/features/managed-models/page/ModelsPage";

export default function ModelsPageRoute() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return <ModelsPage projectId={projectId} />;
}
