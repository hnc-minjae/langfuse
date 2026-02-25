import { useRouter } from "next/router";
import { DataTable } from "@/src/components/table/data-table";
import { type LangfuseColumnDef } from "@/src/components/table/types";
import useColumnVisibility from "@/src/features/column-visibility/hooks/useColumnVisibility";
import useColumnOrder from "@/src/features/column-visibility/hooks/useColumnOrder";
import { api } from "@/src/utils/api";
import { useRowHeightLocalStorage } from "@/src/components/table/data-table-row-height-switch";
import { DataTableToolbar } from "@/src/components/table/data-table-toolbar";
import { Badge } from "@/src/components/ui/badge";

type MenuTemplateProductRow = {
  product: string;
  latestVersion: number;
  versionCount: number;
  labels: string[];
};

export function MenuTemplateTable({ orgId }: { orgId: string }) {
  const router = useRouter();

  const products = api.menuTemplates.allProducts.useQuery(
    { orgId },
    { refetchOnWindowFocus: false },
  );

  const columns: LangfuseColumnDef<MenuTemplateProductRow>[] = [
    {
      accessorKey: "product",
      id: "product",
      header: "Product",
      size: 200,
      enableHiding: true,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.product}</span>
      ),
    },
    {
      accessorKey: "latestVersion",
      id: "latestVersion",
      header: "Latest Version",
      size: 120,
      enableHiding: true,
      cell: ({ row }) => `v${row.original.latestVersion}`,
    },
    {
      accessorKey: "versionCount",
      id: "versionCount",
      header: "Versions",
      size: 100,
      enableHiding: true,
    },
    {
      accessorKey: "labels",
      id: "labels",
      header: "Labels",
      size: 200,
      enableHiding: true,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.labels.map((label) => (
            <Badge key={label} variant="outline" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      ),
    },
  ];

  const [columnVisibility, setColumnVisibility] =
    useColumnVisibility<MenuTemplateProductRow>(
      "menuTemplateColumnVisibility",
      columns,
    );
  const [columnOrder, setColumnOrder] = useColumnOrder<MenuTemplateProductRow>(
    "menuTemplateColumnOrder",
    columns,
  );
  const [rowHeight, setRowHeight] = useRowHeightLocalStorage(
    "menuTemplates",
    "s",
  );

  return (
    <>
      <DataTableToolbar
        columns={columns}
        columnVisibility={columnVisibility}
        setColumnVisibility={setColumnVisibility}
        columnOrder={columnOrder}
        setColumnOrder={setColumnOrder}
        rowHeight={rowHeight}
        setRowHeight={setRowHeight}
      />
      <DataTable
        tableName="menuTemplates"
        columns={columns}
        data={
          products.isPending
            ? { isLoading: true, isError: false }
            : products.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: products.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: products.data,
                }
        }
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        rowHeight={rowHeight}
        onRowClick={(row) => {
          void router.push(
            `/organization/${orgId}/resources/menu-templates/${encodeURIComponent(row.product)}`,
          );
        }}
      />
    </>
  );
}
