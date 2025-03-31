import { Card, CardContent } from "@/components/ui/card";
import { mediaHelpers } from "@/lib/media-helpers";
import { OpenAIIcon, ReplicateIcon } from "@/lib/logos";
import { ProviderKey } from "@/lib/provider-config";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ProviderTiming } from "@/lib/media-types";

import { ImageDisplay } from "./image-display";
import Link from "next/link";

interface ModelSelectProps {
  label: string;
  models: string[];
  value: string;
  providerKey: ProviderKey;
  onChange: (value: string, providerKey: ProviderKey) => void;
  iconPath: string;
  color: string;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  image: string | null | undefined;
  timing?: ProviderTiming;
  failed?: boolean;
  modelId: string;
}

const PROVIDER_ICONS = {
  openai: OpenAIIcon,
  replicate: ReplicateIcon,
} as const;

const PROVIDER_LINKS = {
  openai: "openai",
  replicate: "replicate",
} as const;

export function ModelSelect({
  label,
  models,
  value,
  providerKey,
  onChange,
  enabled = true,
  image,
  timing,
  failed,
  modelId,
}: ModelSelectProps) {
  const Icon = PROVIDER_ICONS[providerKey];

  return (
    <Card className={cn(`w-full transition-opacity`, enabled ? "" : "opacity-50")}>
      <CardContent className="pt-4 h-full">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 w-full transition-opacity duration-200">
            <div className="bg-primary p-1 rounded-full">
              <Link
                className="hover:opacity-80"
                href={
                  "https://sdk.vercel.ai/providers/ai-sdk-providers/" + PROVIDER_LINKS[providerKey]
                }
                target="_blank"
              >
                <div className="text-primary-foreground">
                  <Icon size={20} />
                </div>
              </Link>
            </div>
            <div className="flex flex-col w-full">
              <Link
                className="hover:opacity-80"
                href={
                  "https://sdk.vercel.ai/providers/ai-sdk-providers/" + PROVIDER_LINKS[providerKey]
                }
                target="_blank"
              >
                <h3 className="font-semibold text-sm">{label}</h3>
              </Link>
              <div className="flex justify-between items-center w-full">
                <Select
                  defaultValue={value}
                  value={value}
                  onValueChange={(selectedValue) => onChange(selectedValue, providerKey)}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder={value || "Select a model"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {models.map((model) => (
                        <SelectItem key={model} value={model} className="text-xs">
                          <span className="hidden xl:inline">
                            {mediaHelpers.formatModelId(model).length > 20
                              ? mediaHelpers.formatModelId(model).slice(0, 20) + "..."
                              : mediaHelpers.formatModelId(model)}
                          </span>
                          <span className="hidden lg:inline xl:hidden">
                            {mediaHelpers.formatModelId(model).length > 15
                              ? mediaHelpers.formatModelId(model).slice(0, 15) + "..."
                              : mediaHelpers.formatModelId(model)}
                          </span>

                          <span className="lg:hidden">{mediaHelpers.formatModelId(model)}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <ImageDisplay
          modelId={modelId}
          provider={providerKey}
          image={image}
          timing={timing}
          failed={failed}
        />
      </CardContent>
    </Card>
  );
}
