import { DataTable } from "@/src/components/table/data-table";
import { type LangfuseColumnDef } from "@/src/components/table/types";
import useColumnVisibility from "@/src/features/column-visibility/hooks/useColumnVisibility";
import useColumnOrder from "@/src/features/column-visibility/hooks/useColumnOrder";
import { api } from "@/src/utils/api";
import { useQueryParams, withDefault, StringParam } from "use-query-params";
import { usePaginationState } from "@/src/hooks/usePaginationState";
import { useRowHeightLocalStorage } from "@/src/components/table/data-table-row-height-switch";
import { DataTableToolbar } from "@/src/components/table/data-table-toolbar";
import { PlusIcon, Upload } from "lucide-react";
import { ActionButton } from "@/src/components/ActionButton";
import { useHasOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { UpsertStringResourceDialog } from "./UpsertStringResourceDialog";
import { BulkStringImportDialog } from "./BulkStringImportDialog";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

type StringResourceRow = {
  id: string;
  category: string;
  key: string;
  locale: string;
  value: string;
};

export function StringResourceTable({ orgId }: { orgId: string }) {
  const [paginationState, setPaginationState] = usePaginationState(0, 50, {
    page: "pageIndex",
    limit: "pageSize",
  });

  const [queryParams, setQueryParams] = useQueryParams({
    search: withDefault(StringParam, ""),
    category: withDefault(StringParam, ""),
    locale: withDefault(StringParam, ""),
  });

  const hasWriteAccess = useHasOrganizationAccess({
    organizationId: orgId,
    scope: "resources:CUD",
  });

  const resources = api.stringResources.getAll.useQuery(
    {
      orgId,
      page: paginationState.pageIndex,
      limit: paginationState.pageSize,
      searchQuery: queryParams.search || undefined,
      categoryFilter: queryParams.category || undefined,
      localeFilter: queryParams.locale || undefined,
    },
    { refetchOnWindowFocus: false },
  );

  const utils = api.useUtils();

  const deleteMutation = api.stringResources.delete.useMutation({
    onSuccess: () => void utils.stringResources.invalidate(),
  });

  const totalCount = resources.data?.totalCount ?? null;

  const columns: LangfuseColumnDef<StringResourceRow>[] = [
    {
      accessorKey: "category",
      id: "category",
      header: "Category",
      size: 120,
      enableHiding: true,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.category}
        </Badge>
      ),
    },
    {
      accessorKey: "key",
      id: "key",
      header: "Key",
      size: 160,
      enableHiding: true,
      cell: ({ row }) => <code className="text-xs">{row.original.key}</code>,
    },
    {
      accessorKey: "locale",
      id: "locale",
      header: "Locale",
      size: 80,
      enableHiding: true,
    },
    {
      accessorKey: "value",
      id: "value",
      header: "Value",
      size: 300,
      enableHiding: true,
      cell: ({ row }) => (
        <span className="line-clamp-2 text-sm">{row.original.value}</span>
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
            <UpsertStringResourceDialog
              orgId={orgId}
              existingResource={row.original}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </UpsertStringResourceDialog>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={() => {
                if (confirm(`Delete string "${row.original.key}"?`)) {
                  deleteMutation.mutate({ orgId, id: row.original.id });
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];

  const [columnVisibility, setColumnVisibility] =
    useColumnVisibility<StringResourceRow>(
      "stringResourceColumnVisibility",
      columns,
    );
  const [columnOrder, setColumnOrder] = useColumnOrder<StringResourceRow>(
    "stringResourceColumnOrder",
    columns,
  );
  const [rowHeight, setRowHeight] = useRowHeightLocalStorage(
    "stringResources",
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
            <div className="flex gap-2">
              <BulkStringImportDialog orgId={orgId}>
                <ActionButton icon={<Upload className="h-4 w-4" />}>
                  Bulk Import
                </ActionButton>
              </BulkStringImportDialog>
              <UpsertStringResourceDialog orgId={orgId}>
                <ActionButton icon={<PlusIcon className="h-4 w-4" />}>
                  Add String
                </ActionButton>
              </UpsertStringResourceDialog>
            </div>
          ) : null
        }
      />
      <DataTable
        tableName="stringResources"
        columns={columns}
        data={
          resources.isPending
            ? { isLoading: true, isError: false }
            : resources.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: resources.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: resources.data.resources,
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
