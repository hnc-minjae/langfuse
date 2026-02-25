import { useRouter } from "next/router";
import { StringResourcesPage } from "@/src/features/resource-management/page/StringResourcesPage";
export default function StringResourcesPageRoute() {
  const router = useRouter();
  const organizationId = router.query.organizationId as string;
  if (!organizationId) return null;
  return <StringResourcesPage orgId={organizationId} />;
}
