import { useRouter } from "next/router";
import { DrawableResourcesPage } from "@/src/features/resource-management/page/DrawableResourcesPage";
export default function DrawableResourcesPageRoute() {
  const router = useRouter();
  const organizationId = router.query.organizationId as string;
  if (!organizationId) return null;
  return <DrawableResourcesPage orgId={organizationId} />;
}
