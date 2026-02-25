import { useRouter } from "next/router";
import { MenuTemplateDetailPage } from "@/src/features/resource-management/page/MenuTemplateDetailPage";
export default function MenuTemplateDetailRoute() {
  const router = useRouter();
  const organizationId = router.query.organizationId as string;
  const product = router.query.product as string;
  if (!organizationId || !product) return null;
  return <MenuTemplateDetailPage orgId={organizationId} product={product} />;
}
