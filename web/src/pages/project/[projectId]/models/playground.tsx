import { useRouter } from "next/router";
import { ModelsPlaygroundPage } from "@/src/features/managed-models/page/ModelsPlaygroundPage";

export default function ModelsPlaygroundRoute() {
  const router = useRouter();
  const projectId = router.query.projectId as string;

  if (!projectId) return null;

  return <ModelsPlaygroundPage projectId={projectId} />;
}
