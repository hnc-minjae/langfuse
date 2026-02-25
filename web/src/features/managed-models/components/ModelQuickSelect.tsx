import { api } from "@/src/utils/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { BrandBadge } from "./BrandBadge";

interface ModelQuickSelectProps {
  projectId: string;
  onSelectModel: (params: { brand: string; modelId: string }) => void;
  currentModelId?: string;
}

export function ModelQuickSelect({
  projectId,
  onSelectModel,
  currentModelId,
}: ModelQuickSelectProps) {
  const models = api.managedModels.getAll.useQuery(
    { projectId, page: 0, limit: 100 },
    { refetchOnWindowFocus: false },
  );

  const supportedModels =
    models.data?.models.filter((m) => m.isSupported) ?? [];

  if (supportedModels.length === 0) return null;

  return (
    <Select
      value={currentModelId ?? ""}
      onValueChange={(value) => {
        const selected = supportedModels.find((m) => m.modelId === value);
        if (selected) {
          onSelectModel({
            brand: selected.brand,
            modelId: selected.modelId,
          });
        }
      }}
    >
      <SelectTrigger className="h-8 w-[220px] text-xs">
        <SelectValue placeholder="Quick select model..." />
      </SelectTrigger>
      <SelectContent>
        {supportedModels.map((model) => (
          <SelectItem key={model.id} value={model.modelId}>
            <div className="flex items-center gap-2">
              <BrandBadge
                brand={model.brand}
                displayName={model.brandDisplayName}
              />
              <span>{model.displayName}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
