import { DataTable } from "@/src/components/table/data-table";
import { type LangfuseColumnDef } from "@/src/components/table/types";
import useColumnVisibility from "@/src/features/column-visibility/hooks/useColumnVisibility";
import useColumnOrder from "@/src/features/column-visibility/hooks/useColumnOrder";
import { api } from "@/src/utils/api";
import { useQueryParams, withDefault, StringParam } from "use-query-params";
import { usePaginationState } from "@/src/hooks/usePaginationState";
import { useRowHeightLocalStorage } from "@/src/components/table/data-table-row-height-switch";
import { DataTableToolbar } from "@/src/components/table/data-table-toolbar";
import { PlusIcon, Pencil } from "lucide-react";
import { ActionButton } from "@/src/components/ActionButton";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { BrandBadge } from "./BrandBadge";
import { UpsertManagedModelDialog } from "./UpsertManagedModelDialog";
import { DeleteManagedModelButton } from "./DeleteManagedModelButton";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";

type ManagedModelRow = {
  id: string;
  modelId: string;
  displayName: string;
  brand: string;
  brandDisplayName: string;
  maxInputTokenSize: number | null;
  maxOutputTokenSize: number | null;
  contextWindowSize: number | null;
  isSupported: boolean;
  sortOrder: number;
  capabilities: unknown;
};

function formatTokenCount(count: number | null): string {
  if (count === null) return "-";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(0)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
  return count.toString();
}

export function ManagedModelTable({ projectId }: { projectId: string }) {
  const [paginationState, setPaginationState] = usePaginationState(0, 50, {
    page: "pageIndex",
    limit: "pageSize",
  });

  const [queryParams, setQueryParams] = useQueryParams({
    search: withDefault(StringParam, ""),
    brand: withDefault(StringParam, ""),
  });

  const hasWriteAccess = useHasProjectAccess({
    projectId,
    scope: "managedModels:CUD",
  });

  const models = api.managedModels.getAll.useQuery(
    {
      projectId,
      page: paginationState.pageIndex,
      limit: paginationState.pageSize,
      searchQuery: queryParams.search || undefined,
      brandFilter: queryParams.brand || undefined,
    },
    { refetchOnWindowFocus: false },
  );

  const totalCount = models.data?.totalCount ?? null;

  const columns: LangfuseColumnDef<ManagedModelRow>[] = [
    {
      accessorKey: "displayName",
      id: "displayName",
      header: "Display Name",
      size: 180,
      enableHiding: true,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.displayName}</span>
      ),
    },
    {
      accessorKey: "brand",
      id: "brand",
      header: "Brand",
      size: 120,
      enableHiding: true,
      cell: ({ row }) => (
        <BrandBadge
          brand={row.original.brand}
          displayName={row.original.brandDisplayName}
        />
      ),
    },
    {
      accessorKey: "modelId",
      id: "modelId",
      header: "Model ID",
      size: 180,
      enableHiding: true,
      cell: ({ row }) => (
        <code className="text-xs">{row.original.modelId}</code>
      ),
    },
    {
      accessorKey: "contextWindowSize",
      id: "contextWindowSize",
      header: "Context Window",
      size: 120,
      enableHiding: true,
      cell: ({ row }) => formatTokenCount(row.original.contextWindowSize),
    },
    {
      accessorKey: "maxInputTokenSize",
      id: "maxInputTokenSize",
      header: "Max Input",
      size: 100,
      enableHiding: true,
      cell: ({ row }) => formatTokenCount(row.original.maxInputTokenSize),
    },
    {
      accessorKey: "maxOutputTokenSize",
      id: "maxOutputTokenSize",
      header: "Max Output",
      size: 100,
      enableHiding: true,
      cell: ({ row }) => formatTokenCount(row.original.maxOutputTokenSize),
    },
    {
      accessorKey: "isSupported",
      id: "isSupported",
      header: "Status",
      size: 90,
      enableHiding: true,
      cell: ({ row }) =>
        row.original.isSupported ? (
          <Badge
            variant="outline"
            className="text-xs text-green-700 dark:text-green-400"
          >
            Supported
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Unsupported
          </Badge>
        ),
    },
    {
      accessorKey: "actions",
      id: "actions",
      header: "",
      size: 80,
      enableHiding: false,
      cell: ({ row }) =>
        hasWriteAccess ? (
          <div className="flex items-center gap-1">
            <UpsertManagedModelDialog
              projectId={projectId}
              existingModel={row.original}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </UpsertManagedModelDialog>
            <DeleteManagedModelButton
              projectId={projectId}
              modelId={row.original.id}
              modelName={row.original.displayName}
            />
          </div>
        ) : null,
    },
  ];

  const [columnVisibility, setColumnVisibility] =
    useColumnVisibility<ManagedModelRow>(
      "managedModelsColumnVisibility",
      columns,
    );
  const [columnOrder, setColumnOrder] = useColumnOrder<ManagedModelRow>(
    "managedModelsColumnOrder",
    columns,
  );
  const [rowHeight, setRowHeight] = useRowHeightLocalStorage(
    "managedModels",
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
        searchConfig={{
          updateQuery: (value) => setQueryParams({ search: value }),
          currentQuery: queryParams.search ?? "",
          tableAllowsFullTextSearch: true,
        }}
        actionButtons={
          hasWriteAccess ? (
            <UpsertManagedModelDialog projectId={projectId}>
              <ActionButton icon={<PlusIcon className="h-4 w-4" />}>
                Add Model
              </ActionButton>
            </UpsertManagedModelDialog>
          ) : null
        }
      />
      <DataTable
        tableName="managedModels"
        columns={columns}
        data={
          models.isPending
            ? { isLoading: true, isError: false }
            : models.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: models.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: models.data.models,
                }
        }
        pagination={{
          totalCount,
          onChange: setPaginationState,
          state: paginationState,
        }}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        columnOrder={columnOrder}
        onColumnOrderChange={setColumnOrder}
        rowHeight={rowHeight}
      />
    </>
  );
}
