import { useRouter } from "next/router";
import { MenuTemplatesPage } from "@/src/features/resource-management/page/MenuTemplatesPage";
export default function MenuTemplatesPageRoute() {
  const router = useRouter();
  const organizationId = router.query.organizationId as string;
  if (!organizationId) return null;
  return <MenuTemplatesPage orgId={organizationId} />;
}
