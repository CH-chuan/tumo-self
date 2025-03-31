"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ModelSelect } from "@/components/model-select";
import { PromptInput } from "@/components/prompt-input";
import { ModelCardCarousel } from "@/components/model-card-carousel";
import {
  MODEL_CONFIGS,
  PROVIDERS,
  PROVIDER_ORDER,
  ProviderKey,
  ModelMode,
} from "@/lib/provider-config";
import { Suggestion } from "@/lib/suggestions";
import { useImageGeneration, GenerationHistoryEntry } from "@/hooks/use-image-generation";
import { ImageDisplay } from "@/components/image-display";
import { Button } from "./ui/button";
import { Trash, Clock, X, ImageIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { GeneratedImage } from "@/lib/media-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ImagePlayground({ suggestions }: { suggestions: Suggestion[] }) {
  // Track whether we've completed the initial history load
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const {
    images,
    timings,
    failedProviders,
    isLoading,
    isLoadingHistory,
    startGeneration,
    activePrompt,
    generationHistory,
    clearHistory,
    deleteGeneration,
    deleteImage,
  } = useImageGeneration();

  // Track when the initial history load completes
  useEffect(() => {
    if (isLoadingHistory) {
      // Still loading
      return;
    }

    // If we were loading and now we're not, we've completed the initial load
    if (!initialLoadComplete) {
      setInitialLoadComplete(true);
    }
  }, [isLoadingHistory, initialLoadComplete]);

  // Log state values for debugging
  useEffect(() => {
    console.log("Image Playground State:", {
      isLoading,
      isLoadingHistory,
      initialLoadComplete,
      generationHistoryLength: generationHistory.length,
      emptyStateVisible:
        !isLoading && !isLoadingHistory && initialLoadComplete && generationHistory.length === 0,
    });
  }, [isLoading, isLoadingHistory, initialLoadComplete, generationHistory.length]);

  // State for deletion confirmations
  const [generationToDelete, setGenerationToDelete] = useState<string | null>(null);
  const [imageToDelete, setImageToDelete] = useState<{
    generationId: string;
    provider: ProviderKey;
  } | null>(null);

  // Add state for error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add ref for tracking submission attempts to prevent rapid clicking
  const isSubmittingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

  const [showProviders, setShowProviders] = useState(true);
  const [selectedModels, setSelectedModels] = useState<Record<ProviderKey, string>>(
    MODEL_CONFIGS.performance
  );
  // Always enable both providers since we removed the UI selection
  const [enabledProviders, setEnabledProviders] = useState<Record<ProviderKey, boolean>>({
    replicate: true,
    openai: true,
  });
  // Always use performance mode since we removed the UI selection
  const mode: ModelMode = "performance";
  const toggleView = () => {
    setShowProviders((prev) => !prev);
  };

  const handleModelChange = (provider: ProviderKey, model: string) => {
    setSelectedModels((prev) => ({ ...prev, [provider]: model }));
  };

  const handleProviderToggle = (provider: string, enabled: boolean) => {
    setEnabledProviders((prev) => ({
      ...prev,
      [provider]: enabled,
    }));
  };

  const providerToModel = {
    replicate: selectedModels.replicate,
    openai: selectedModels.openai,
  };

  // Debounced version of prompt submission to prevent rapid clicking
  const handlePromptSubmit = useCallback(
    async (newPrompt: string) => {
      // Clear any previous errors
      setErrorMessage(null);

      // Get current time for debouncing
      const now = Date.now();

      // Prevent rapid clicking (within 500ms)
      if (now - lastSubmitTimeRef.current < 500) {
        setErrorMessage("Please wait a moment before generating again");
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }

      // Prevent submissions while already generating
      if (isLoading) {
        setErrorMessage("A generation is already in progress. Please wait for it to complete.");
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }

      // Mark as submitting
      isSubmittingRef.current = true;
      lastSubmitTimeRef.current = now;

      try {
        const activeProviders = PROVIDER_ORDER.filter((p) => enabledProviders[p]);

        // Check if any providers are selected
        if (activeProviders.length === 0) {
          setErrorMessage("Please select at least one provider to generate images.");
          setTimeout(() => setErrorMessage(null), 3000);
          return;
        }

        const result = await startGeneration(newPrompt, activeProviders, providerToModel);

        if (!result.success && result.error) {
          // Display the error message
          setErrorMessage(result.error);
          // Keep error visible for 3 seconds
          setTimeout(() => setErrorMessage(null), 3000);
          return;
        }

        setShowProviders(false);
      } finally {
        // Reset submission status when done, with a small delay
        setTimeout(() => {
          isSubmittingRef.current = false;
        }, 500);
      }
    },
    [enabledProviders, providerToModel, startGeneration, isLoading]
  );

  // Helper functions to handle deletion with confirmation
  const handleDeleteGeneration = (generationId: string) => {
    deleteGeneration(generationId);
    setGenerationToDelete(null);
  };

  const handleDeleteImage = (generationId: string, provider: ProviderKey) => {
    // Add debugging to check if the generation and image exist before deletion
    const generation = generationHistory.find((entry) => entry.id === generationId);
    if (!generation) {
      console.error(
        `Attempted to delete image from non-existent generation with ID: ${generationId}`
      );
      console.error(
        "Available generation IDs:",
        generationHistory.map((g) => g.id)
      );
      setImageToDelete(null);
      return;
    }

    const imageExists = generation.images.some((img) => img.provider === provider);
    if (!imageExists) {
      console.error(
        `Attempted to delete non-existent image with provider ${provider} from generation ${generationId}`
      );
      console.error(
        "Available providers for this generation:",
        generation.images.map((img) => img.provider)
      );
      setImageToDelete(null);
      return;
    }

    console.log(`Deleting image: generationId=${generationId}, provider=${provider}`);
    deleteImage(generationId, provider);
    setImageToDelete(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto">
        <div className="relative border-t-thin">
          {/* Full-height divider */}
          <div className="hidden lg:block full-height-divider left-[20%]"></div>
          <div className="bg-background">
            {/* Error Message Toast */}
            {errorMessage && (
              <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-5 duration-300">
                <div className="bg-destructive text-destructive-foreground px-6 py-4 rounded-md shadow-lg flex items-center gap-3">
                  <div className="w-6 h-6 text-destructive-foreground flex-shrink-0">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  </div>
                  <span className="font-medium text-sm">{errorMessage}</span>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-5">
              {/* Left Sidebar - Prompt Input - Fixed below header */}
              <div className="col-span-5 lg:col-span-1 p-4 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-4rem)]">
                <div className="space-y-4">
                  <PromptInput
                    onSubmit={handlePromptSubmit}
                    isLoading={isLoading}
                    showProviders={showProviders}
                    onToggleProviders={toggleView}
                    mode={mode}
                    suggestions={suggestions}
                  />

                  {/* Provider and Model Selection */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-medium">Select Providers & Models</h3>
                    <div className="space-y-4">
                      {/* Replicate */}
                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          className="w-full flex items-center justify-between"
                          onClick={() =>
                            handleProviderToggle("replicate", !enabledProviders.replicate)
                          }
                        >
                          <span className="flex items-center gap-2">
                            <img
                              src={PROVIDERS.replicate.iconPath}
                              alt="Replicate"
                              className="w-4 h-4"
                            />
                            {PROVIDERS.replicate.displayName}
                          </span>
                          <div
                            className={`h-3 w-3 rounded-full transition-colors ${
                              enabledProviders.replicate ? "bg-green-500" : "bg-zinc-200"
                            }`}
                          ></div>
                        </Button>
                        {enabledProviders.replicate && (
                          <Select
                            defaultValue={selectedModels.replicate}
                            value={selectedModels.replicate}
                            onValueChange={(value) => handleModelChange("replicate", value)}
                          >
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {PROVIDERS.replicate.models.map((model) => (
                                  <SelectItem key={model} value={model}>
                                    {model}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* OpenAI */}
                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          className="w-full flex items-center justify-between"
                          onClick={() => handleProviderToggle("openai", !enabledProviders.openai)}
                        >
                          <span className="flex items-center gap-2">
                            <img src={PROVIDERS.openai.iconPath} alt="OpenAI" className="w-4 h-4" />
                            {PROVIDERS.openai.displayName}
                          </span>
                          <div
                            className={`h-3 w-3 rounded-full transition-colors ${
                              enabledProviders.openai ? "bg-green-500" : "bg-zinc-200"
                            }`}
                          ></div>
                        </Button>
                        {enabledProviders.openai && (
                          <Select
                            defaultValue={selectedModels.openai}
                            value={selectedModels.openai}
                            onValueChange={(value) => handleModelChange("openai", value)}
                          >
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {PROVIDERS.openai.models.map((model) => (
                                  <SelectItem key={model} value={model}>
                                    {model}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Content - All Generations - Scrollable */}
              <div className="col-span-5 lg:col-span-4 p-4 lg:overflow-y-auto lg:max-h-[calc(100vh-4rem)] lg:pb-16">
                {/* Loading State for Generation History */}
                {isLoadingHistory && (
                  <div className="h-full flex flex-col items-center justify-center py-20 gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground text-sm">
                      Loading your generation history...
                    </p>
                  </div>
                )}

                {/* Empty State - Only shown when:  
                  * Not currently generating images (!isLoading)
                  * History has finished loading (we've completed the initial load)
                  * We've confirmed the initial load is complete (initialLoadComplete)
                  * No existing generations in history (generationHistory.length === 0)
                  This prevents the empty state from flashing briefly during initial load */}
                {!isLoading &&
                  !isLoadingHistory &&
                  initialLoadComplete &&
                  generationHistory.length === 0 && (
                    <div className="h-full flex items-center justify-center py-20">
                      <p className="text-muted-foreground text-sm">
                        Your generated images will appear here
                      </p>
                    </div>
                  )}

                {/* All Generations List */}
                <div className="space-y-12">
                  {/* Current Generation (if not yet in history) */}
                  {isLoading && activePrompt && (
                    <div className="space-y-3 pb-8 border-b">
                      {/* Prompt */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{activePrompt}</p>
                      </div>

                      {/* Provider Labels and Models */}
                      <div className="grid grid-cols-4 gap-3 mb-1">
                        {PROVIDER_ORDER.filter((provider) => enabledProviders[provider]).map(
                          (provider) => {
                            const imageItem = images.find((img) => img.provider === provider);
                            const modelId = imageItem?.modelId || providerToModel[provider] || "";
                            const displayName = PROVIDERS[provider]?.displayName || provider;

                            return (
                              <div
                                key={`label-${provider}`}
                                className="text-xs font-medium flex items-center gap-1"
                              >
                                <span className="capitalize">{displayName}</span>
                                <span className="text-xs text-muted-foreground"> {modelId}</span>
                              </div>
                            );
                          }
                        )}
                      </div>

                      {/* Images (placeholders during loading) */}
                      <div className="grid grid-cols-4 gap-3">
                        {PROVIDER_ORDER.filter((provider) => enabledProviders[provider]).map(
                          (provider) => {
                            const imageItem = images.find((img) => img.provider === provider);
                            const imageData = imageItem?.content || (imageItem as any)?.image;
                            return (
                              <ImageDisplay
                                key={provider}
                                provider={provider}
                                image={imageData}
                                timing={timings[provider]}
                                failed={failedProviders.includes(provider)}
                                enabled={enabledProviders[provider]}
                                modelId={imageItem?.modelId || ""}
                                imagePath={imageItem?.mediaPath || (imageItem as any)?.imagePath}
                                imageUrl={imageItem?.mediaUrl || (imageItem as any)?.imageUrl}
                              />
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}

                  {/* All Generations (including completed current one) */}
                  {generationHistory.map((entry) => (
                    <div key={entry.id} className="space-y-3 pb-8 border-b last:border-b-0">
                      {/* Timestamp, prompt, and delete button */}
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Clock size={14} className="mr-1" />
                            <span>{formatDistanceToNow(entry.timestamp)} ago</span>
                          </div>
                          <p className="text-sm font-medium">{entry.prompt}</p>
                        </div>

                        {/* Delete generation button */}
                        <AlertDialog
                          open={generationToDelete === entry.id}
                          onOpenChange={(isOpen: boolean) => !isOpen && setGenerationToDelete(null)}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setGenerationToDelete(entry.id)}
                            >
                              <Trash size={16} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete all images in this generation?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove all images in this generation.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setGenerationToDelete(null);
                                }}
                              >
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteGeneration(entry.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete All
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {/* Provider Labels */}
                      <div className="grid grid-cols-4 gap-3 mb-1">
                        {entry.images.map((img) => {
                          const provider = img.provider;
                          const displayName = PROVIDERS[provider]?.displayName || provider;
                          const modelId = img.modelId || "";

                          return (
                            <div
                              key={`history-label-${entry.id}-${provider}`}
                              className="text-xs font-medium flex items-center gap-1 justify-between group"
                            >
                              <div>
                                <span className="capitalize">{displayName}</span>
                                <span className="text-xs text-muted-foreground"> {modelId}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Images */}
                      <div className="grid grid-cols-4 gap-3">
                        {entry.images.map((img) => {
                          // Cast to GeneratedImage for backward compatibility
                          const imgData = img as unknown as GeneratedImage;

                          // Create delete button element to pass as prop
                          const deleteButton = (
                            <AlertDialog
                              open={
                                imageToDelete?.generationId === entry.id &&
                                imageToDelete?.provider === imgData.provider
                              }
                              onOpenChange={(isOpen: boolean) => !isOpen && setImageToDelete(null)}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10 bg-background/80 backdrop-blur-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setImageToDelete({
                                      generationId: entry.id,
                                      provider: imgData.provider as ProviderKey,
                                    });
                                  }}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete this image?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove the{" "}
                                    {PROVIDERS[imgData.provider]?.displayName || imgData.provider}{" "}
                                    image from this generation.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setImageToDelete(null);
                                    }}
                                  >
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleDeleteImage(entry.id, imgData.provider as ProviderKey);
                                    }}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          );

                          return (
                            <div key={`${entry.id}-${imgData.provider}`} className="group relative">
                              <ImageDisplay
                                provider={imgData.provider}
                                image={imgData.content || imgData.image}
                                modelId={imgData.modelId || ""}
                                timing={entry.timings[imgData.provider]}
                                failed={entry.failedProviders.includes(imgData.provider as any)}
                                imagePath={imgData.mediaPath || imgData.imagePath}
                                imageUrl={imgData.mediaUrl || imgData.imageUrl}
                                deleteButton={deleteButton}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
