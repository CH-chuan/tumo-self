import { useState, useRef, useCallback, useEffect } from "react";
import { MediaError, MediaResult, ProviderTiming, MediaType } from "@/lib/media-types";
import { initializeProviderRecord, ProviderKey, PROVIDER_ORDER } from "@/lib/provider-config";

// Define a structure for generation history entries
export interface GenerationHistoryEntry {
  id: string; // Unique ID for each generation
  prompt: string;
  timestamp: number;
  images: MediaResult[];
  errors: MediaError[];
  timings: Record<ProviderKey, ProviderTiming>;
  failedProviders: ProviderKey[];
}

interface UseImageGenerationReturn {
  images: MediaResult[];
  errors: MediaError[];
  timings: Record<ProviderKey, ProviderTiming>;
  failedProviders: ProviderKey[];
  isLoading: boolean;
  isLoadingHistory: boolean; // Added to expose loading state for generation history
  startGeneration: (
    prompt: string,
    providers: ProviderKey[],
    providerToModel: Record<ProviderKey, string>
  ) => Promise<{ success: boolean; error?: string }>;
  resetState: () => void;
  activePrompt: string;
  // Add history to the return type
  generationHistory: GenerationHistoryEntry[];
  clearHistory: () => void;
  deleteGeneration: (generationId: string) => void;
  deleteImage: (generationId: string, provider: ProviderKey) => void;
}

export function useImageGeneration(): UseImageGenerationReturn {
  const [images, setImages] = useState<MediaResult[]>([]);
  const [errors, setErrors] = useState<MediaError[]>([]);
  const [timings, setTimings] = useState<Record<ProviderKey, ProviderTiming>>(
    initializeProviderRecord<ProviderTiming>()
  );
  const [failedProviders, setFailedProviders] = useState<ProviderKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState("");
  // Add state for generation history
  const [generationHistory, setGenerationHistory] = useState<GenerationHistoryEntry[]>([]);
  // Add state for loading saved generations
  const [isLoadingSavedGenerations, setIsLoadingSavedGenerations] = useState(false);

  // Simple flag to track if generation is in progress
  const isGeneratingRef = useRef(false);

  // We no longer need to track a session generation ID as we'll use database IDs

  // Load any in-progress generation from localStorage on initial mount
  useEffect(() => {
    try {
      const storedGeneration = localStorage.getItem("currentGeneration");
      if (storedGeneration) {
        const { id, prompt, timestamp } = JSON.parse(storedGeneration);
        // Only restore if the generation is recent (within last 5 minutes)
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          console.log("Restoring in-progress generation from localStorage:", { id, prompt });
          // We'll use the database ID directly
          currentGenerationRef.current = {
            id,
            prompt,
            timestamp,
            images: new Map(),
            errors: [],
            timings: initializeProviderRecord<ProviderTiming>(),
            failedProviders: [],
          };
          // Set isLoading to true since we're restoring an in-progress generation
          setIsLoading(true);
        } else {
          // Clear expired generation data
          localStorage.removeItem("currentGeneration");
        }
      }
    } catch (error) {
      console.error("Error restoring generation from localStorage:", error);
      localStorage.removeItem("currentGeneration");
    }
  }, []);

  // Keep track of the current generation state
  const currentGenerationRef = useRef<{
    id: string | null;
    prompt: string;
    timestamp: number;
    images: Map<ProviderKey, MediaResult>;
    errors: MediaError[];
    timings: Record<ProviderKey, ProviderTiming>;
    failedProviders: ProviderKey[];
  }>({
    id: null,
    prompt: "",
    timestamp: 0,
    images: new Map(),
    errors: [],
    timings: initializeProviderRecord<ProviderTiming>(),
    failedProviders: [],
  });

  // Load saved generations from the database on initial mount
  useEffect(() => {
    async function loadSavedGenerations() {
      try {
        setIsLoadingSavedGenerations(true);
        const response = await fetch("/api/generations");

        // If not authenticated or other error, just continue without saved generations
        if (!response.ok) {
          console.log("Failed to load saved generations:", response.status);
          return;
        }

        const data = await response.json();

        // Convert the API response to the format expected by the hook
        if (data.generations && Array.isArray(data.generations)) {
          // Convert each generation directly to our format
          // WITHOUT grouping by prompt (maintain the original database relationship)
          const convertedGenerations: GenerationHistoryEntry[] = data.generations.map(
            (gen: any) => {
              // Convert each media item to the expected format
              const mediaResults: MediaResult[] = gen.mediaItems.map((item: any) => {
                const mediaResult: MediaResult = {
                  provider: item.provider as ProviderKey,
                  content: null, // Base64 content not stored in DB, only paths
                  modelId: item.modelId || "",
                  mediaType: item.mediaType as MediaType,
                  mediaPath: item.mediaPath,
                  mediaUrl: item.mediaUrl,
                  // For backward compatibility
                  image: null,
                  imagePath: item.mediaPath,
                  imageUrl: item.mediaUrl,
                } as MediaResult;

                return mediaResult;
              });

              // Create default empty timings for each provider
              const timingsRecord = initializeProviderRecord<ProviderTiming>();

              // Return the formatted generation entry with its ORIGINAL ID
              return {
                id: gen.id,
                prompt: gen.prompt,
                timestamp: new Date(gen.timestamp).getTime(),
                images: mediaResults,
                errors: [],
                timings: timingsRecord,
                failedProviders: [],
              };
            }
          );

          // Sort by timestamp, newest first
          const sortedGenerations = convertedGenerations.sort((a, b) => b.timestamp - a.timestamp);

          // Update state with the loaded generations
          setGenerationHistory(sortedGenerations);
        }
      } catch (error) {
        console.error("Error loading saved generations:", error);
      } finally {
        setIsLoadingSavedGenerations(false);
      }
    }

    // Load saved generations
    loadSavedGenerations();
  }, []);

  const resetState = () => {
    setImages([]);
    setErrors([]);
    setTimings(initializeProviderRecord<ProviderTiming>());
    setFailedProviders([]);
    setIsLoading(false);
  };

  const clearHistory = () => {
    setGenerationHistory([]);
  };

  // Function to delete a specific generation
  const deleteGeneration = async (generationId: string) => {
    try {
      // Find the generation to delete
      const generationToDelete = generationHistory.find((entry) => entry.id === generationId);
      if (!generationToDelete) {
        console.error("Generation not found for deletion:", generationId);
        return;
      }

      // Call the API to delete the generation
      const response = await fetch(`/api/generations/${generationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        console.error(`Failed to delete generation ${generationId}:`, response.status);
        return;
      }

      // Update local state to remove the specific generation by ID
      setGenerationHistory((prev) => prev.filter((entry) => entry.id !== generationId));
    } catch (error) {
      console.error("Error deleting generation:", error);
    }
  };

  // Function to delete a specific image from a generation
  const deleteImage = async (generationId: string, provider: ProviderKey, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second delay between retries

    try {
      console.log(
        `Attempting to delete image [generationId=${generationId}, provider=${provider}, retry=${retryCount}]`
      );

      // Call the API to delete the image
      const response = await fetch(`/api/generations/${generationId}/media/${provider}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Enhanced error logging with more details and proper error handling
        let errorData: any = { status: response.status };
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              errorData = { ...errorData, ...JSON.parse(errorText) };
            } catch (e) {
              errorData.text = errorText;
            }
          }

          console.error("Failed to delete image:", {
            status: response.status,
            statusText: response.statusText || "No status text",
            error: errorData,
            url: `/api/generations/${generationId}/media/${provider}`,
            retryCount,
          });

          // If we get a 404 error and haven't exceeded max retries, try again after a delay
          if (response.status === 404 && retryCount < MAX_RETRIES) {
            console.log(
              `Image not found (404), retrying in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`
            );
            setTimeout(() => {
              deleteImage(generationId, provider, retryCount + 1);
            }, RETRY_DELAY);
            return;
          }
        } catch (parseError) {
          console.error("Failed to delete image - response parsing error:", {
            status: response.status,
            statusText: response.statusText || "No status text",
            parseError: parseError instanceof Error ? parseError.message : String(parseError),
            url: `/api/generations/${generationId}/media/${provider}`,
            retryCount,
          });
        }
        return;
      }

      // Update local state
      setGenerationHistory(
        (prev) =>
          prev
            .map((entry) => {
              if (entry.id === generationId) {
                // Remove the image with the matching provider
                const updatedImages = entry.images.filter((img) => img.provider !== provider);

                // If there are still images left, return the updated entry
                if (updatedImages.length > 0) {
                  return {
                    ...entry,
                    images: updatedImages,
                  };
                }
                // If no images left, return null to filter it out
                return null;
              }
              return entry;
            })
            .filter(Boolean) as GenerationHistoryEntry[]
      );

      console.log(`Successfully deleted image: ${provider} from generation ${generationId}`);
    } catch (error) {
      console.error(
        "Error deleting image:",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  // Function to add current generation to history
  const saveGenerationToHistory = useCallback(() => {
    const current = currentGenerationRef.current;
    console.log("Saving generation to history:", {
      id: current.id,
      prompt: current.prompt,
      imagesCount: current.images.size,
      isClientId: current.id?.includes("-"), // Check if it's a client ID (contains a dash) or a database ID
    });

    // Only save if we have a valid generation with at least one image
    if (current.id && current.images.size > 0) {
      // Convert map to array and sort according to PROVIDER_ORDER
      const imagesByProvider = current.images;
      const imageArray = PROVIDER_ORDER.filter((provider: ProviderKey) =>
        imagesByProvider.has(provider)
      ).map((provider: ProviderKey) => imagesByProvider.get(provider)!);

      // Only save if we have at least one successful image
      if (imageArray.some((img) => img.content !== null)) {
        const historyEntry: GenerationHistoryEntry = {
          id: current.id,
          prompt: current.prompt,
          timestamp: current.timestamp,
          images: imageArray,
          errors: [...current.errors],
          timings: { ...current.timings },
          failedProviders: [...current.failedProviders],
        };

        setGenerationHistory((prev) => {
          // Check if this generation is already in the history to prevent duplicates
          const existingIndex = prev.findIndex((entry) => entry.id === current.id);

          if (existingIndex !== -1) {
            console.log(
              `Generation ${current.id} already exists in history - checking if update needed`
            );

            // Compare image counts to see if we should update
            const existingEntry = prev[existingIndex];
            const existingImageCount = existingEntry.images.length;
            const newImageCount = imageArray.length;

            // Only update if we have more images than before
            if (newImageCount > existingImageCount) {
              console.log(
                `Updating existing history entry - new images: ${newImageCount}, old: ${existingImageCount}`
              );
              // Create a new array with the updated entry
              const updatedHistory = [...prev];
              updatedHistory[existingIndex] = historyEntry;
              return updatedHistory;
            } else {
              console.log("No update needed - existing entry has same or more images");
              return prev;
            }
          }

          console.log(`Adding new generation ${current.id} to history`);
          return [historyEntry, ...prev];
        });
      } else {
        console.log("Not saving to history - no successful images");
      }

      // Reset current generation tracking
      currentGenerationRef.current = {
        id: null,
        prompt: "",
        timestamp: 0,
        images: new Map(),
        errors: [],
        timings: initializeProviderRecord<ProviderTiming>(),
        failedProviders: [],
      };

      // No need to reset session generation ID anymore as we're using database IDs

      // Clear from localStorage
      try {
        localStorage.removeItem("currentGeneration");
      } catch (error) {
        console.error("Error removing generation from localStorage:", error);
      }
    } else {
      console.log("Not saving to history - invalid or empty generation");
    }
  }, []);

  const startGeneration = async (
    prompt: string,
    providers: ProviderKey[],
    providerToModel: Record<ProviderKey, string>
  ): Promise<{ success: boolean; error?: string }> => {
    // Log state for debugging
    console.log("Generation attempt:", {
      prompt: prompt,
      isGeneratingRef: isGeneratingRef.current,
      currentId: currentGenerationRef.current.id,
      isLoadingState: isLoading,
      currentPrompt: currentGenerationRef.current.prompt,
      providersCount: providers.length,
    });

    // Validate that we have at least one provider selected
    if (!providers || providers.length === 0) {
      console.log("No providers selected for generation");
      return {
        success: false,
        error: "Please select at least one provider to generate images.",
      };
    }

    // If already generating, prevent starting a new generation
    if (isGeneratingRef.current) {
      console.log("Generation already in progress, please wait until it completes");
      return {
        success: false,
        error: "A generation is already in progress. Please wait for it to complete.",
      };
    }

    // Set the generating flag
    isGeneratingRef.current = true;
    setIsLoading(true);

    try {
      // Save any previous generation first
      saveGenerationToHistory();

      // We'll use a temporary client-side ID until we get a database ID from the API
      // This is just for tracking purposes on the client side
      const timestamp = Date.now();
      const tempClientId = `temp-${timestamp}-${Math.random().toString(36).substring(2, 5)}`;

      console.log("Using temporary client ID:", tempClientId, "for prompt:", prompt);

      // We'll update this with the real database ID when we get a response from the API

      // Set up the new generation with the temporary ID
      currentGenerationRef.current = {
        id: tempClientId, // We'll update this with the real database ID when we get it
        prompt: prompt,
        timestamp: timestamp,
        images: new Map(),
        errors: [],
        timings: initializeProviderRecord<ProviderTiming>(),
        failedProviders: [],
      };

      // Save to localStorage for persistence across page refreshes
      try {
        localStorage.setItem(
          "currentGeneration",
          JSON.stringify({
            id: tempClientId,
            prompt: prompt,
            timestamp: timestamp,
          })
        );
      } catch (error) {
        console.error("Error saving generation to localStorage:", error);
      }

      // Update UI state
      setActivePrompt(prompt);

      // Initialize images array with null values for display
      const initialImages = providers.map((provider) => ({
        provider,
        content: null,
        image: null, // For backward compatibility
        modelId: providerToModel[provider],
        mediaType: MediaType.IMAGE,
      }));

      setImages(initialImages);

      // Clear previous state
      setErrors([]);
      setFailedProviders([]);

      // Initialize timings with start times
      const initialTimings = Object.fromEntries(
        providers.map((provider) => [provider, { startTime: timestamp }])
      ) as Record<ProviderKey, ProviderTiming>;

      setTimings(initialTimings);

      // Initialize timings in generation ref as well
      currentGenerationRef.current.timings = { ...initialTimings };

      // Helper to fetch a single provider
      const generateImage = async (provider: ProviderKey, modelId: string) => {
        const startTime = timestamp;
        console.log(`Generate image request [provider=${provider}, modelId=${modelId}]`);
        try {
          const request = {
            prompt,
            provider,
            modelId,
            // We're not sending clientGenerationId anymore as we're relying on database queries
            // We're not sending userId here as the API will use the authenticated user
          };

          const response = await fetch("/api/generate-images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          });
          const data = await response.json();
          if (!response.ok) {
            // Extract error details from the response
            const errorMessage = data.error || `Server error: ${response.status}`;
            const errorType = data.errorType || "UnknownError";

            // Create a custom error with additional properties
            const customError = new Error(errorMessage);
            (customError as any).status = response.status;
            (customError as any).errorType = errorType;

            // For gateway timeouts, provide a more specific error message
            if (response.status === 504 || errorType === "TimeoutError") {
              (customError as any).isTimeout = true;
              customError.message =
                "Image generation timed out. Please try a simpler prompt or try again later.";
            }

            throw customError;
          }

          const completionTime = Date.now();
          const elapsed = completionTime - startTime;

          // Update timings in both state and ref
          const newTiming = {
            startTime,
            completionTime,
            elapsed,
          };

          setTimings((prev) => ({
            ...prev,
            [provider]: newTiming,
          }));

          // Also update in our ref
          currentGenerationRef.current.timings[provider] = newTiming;

          console.log(
            `Successful image response [provider=${provider}, modelId=${modelId}, elapsed=${elapsed}ms]`
          );

          // If the API returned a database generationId, update our current generation ID
          if (data.generationId) {
            console.log(
              `Received database generationId: ${data.generationId} for client ID: ${tempClientId}`
            );
            // Only update the ID if we haven't already set it from a previous provider response
            if (currentGenerationRef.current.id === tempClientId) {
              currentGenerationRef.current.id = data.generationId;
              // Update in localStorage as well
              try {
                const storedGeneration = localStorage.getItem("currentGeneration");
                if (storedGeneration) {
                  const parsed = JSON.parse(storedGeneration);
                  localStorage.setItem(
                    "currentGeneration",
                    JSON.stringify({
                      ...parsed,
                      id: data.generationId,
                    })
                  );
                }
              } catch (error) {
                console.error("Error updating generationId in localStorage:", error);
              }
            }
          }

          // Create the result with the generated image
          const mediaResult: MediaResult = {
            provider,
            content: data.image ?? null,
            modelId,
            mediaType: MediaType.IMAGE,
            mediaPath: data.imagePath,
            mediaUrl: data.imageUrl,
          };

          // For backward compatibility - TypeScript doesn't know about these properties
          (mediaResult as any).image = data.image ?? null;
          (mediaResult as any).imagePath = data.imagePath;
          (mediaResult as any).imageUrl = data.imageUrl;

          // Store in our generation ref
          currentGenerationRef.current.images.set(provider, mediaResult);

          // Update UI state
          setImages((prevImages) =>
            prevImages.map((item) => (item.provider === provider ? mediaResult : item))
          );

          // Log if the image was saved to storage
          if (data.imagePath) {
            console.log(`Image saved to: ${data.imagePath}`);
          }
        } catch (err) {
          console.error(`Error [provider=${provider}, modelId=${modelId}]:`, err);

          // Store error info in state
          setFailedProviders((prev) => [...prev, provider]);

          // Extract more detailed error information
          let errorMessage = "An unexpected error occurred";
          let errorType = "UnknownError";

          if (err instanceof Error) {
            errorMessage = err.message;
            errorType = (err as any).errorType || err.name || "UnknownError";

            // For timeout errors, provide a more user-friendly message
            if (
              (err as any).isTimeout ||
              (err as any).status === 504 ||
              errorType === "TimeoutError"
            ) {
              errorMessage =
                "Image generation took too long. Please try a simpler prompt or try again later.";
              errorType = "TimeoutError";
            }
          }

          const errorInfo = {
            provider,
            message: errorMessage,
            errorType: errorType,
          };

          setErrors((prev) => [...prev, errorInfo]);

          // Also store in our ref
          currentGenerationRef.current.failedProviders.push(provider);
          currentGenerationRef.current.errors.push(errorInfo);

          // Update the image state to show failure
          setImages((prevImages) =>
            prevImages.map((item) =>
              item.provider === provider
                ? {
                    ...item,
                    content: null,
                    image: null,
                  }
                : item
            )
          );
        }
      };

      // Generate images for all active providers
      const fetchPromises = providers.map((provider) => {
        const modelId = providerToModel[provider];
        return generateImage(provider, modelId);
      });

      await Promise.all(fetchPromises);

      return { success: true };
    } catch (error) {
      console.error("Error fetching images:", error);

      // Clear from localStorage on error
      try {
        localStorage.removeItem("currentGeneration");
      } catch (storageError) {
        console.error("Error removing generation from localStorage:", storageError);
      }

      // Provide a more specific error message based on the error type
      let errorMessage = "Failed to generate images";

      if (error instanceof Error) {
        // Use the error message from the Error object
        errorMessage = error.message;

        // Check for specific error types
        if (
          (error as any).status === 504 ||
          (error as any).isTimeout ||
          error.name === "TimeoutError"
        ) {
          errorMessage =
            "Image generation timed out. Please try a simpler prompt or try again later.";
        } else if ((error as any).status === 429) {
          errorMessage = "Rate limit exceeded. Please try again later.";
        } else if (error.message.includes("content policy") || error.message.includes("safety")) {
          errorMessage =
            "Your prompt may violate content policies. Please modify your prompt and try again.";
        }
      }

      return { success: false, error: errorMessage };
    } finally {
      // Clear generation status
      isGeneratingRef.current = false;
      setIsLoading(false);

      // Save this generation to history immediately
      saveGenerationToHistory();

      // Clear localStorage to prevent reuse
      try {
        localStorage.removeItem("currentGeneration");
      } catch (error) {
        console.error("Error removing generation from localStorage in finally block:", error);
      }

      console.log("Generation complete, cleared localStorage");
    }
  };

  return {
    images,
    errors,
    timings,
    failedProviders,
    isLoading,
    isLoadingHistory: isLoadingSavedGenerations, // Expose the loading state for generation history
    startGeneration,
    resetState,
    activePrompt,
    generationHistory,
    clearHistory,
    deleteGeneration,
    deleteImage,
  };
}
