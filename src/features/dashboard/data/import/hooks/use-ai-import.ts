/**
 * React Query Hook for AI Import
 *
 * Provides all mutations and queries for the Smart Import feature.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImportAnalysisResult } from "@/lib/ai/import/types";

// ============================================================================
// Types
// ============================================================================

export interface AnalyzeResponse {
  success: boolean;
  sessionId: string;
  analysis: ImportAnalysisResult;
  parsedData: Array<Record<string, string>>;
  headers: string[];
  metrics: {
    aiCallCount: number;
    totalTokens: number;
    estimatedCost: number;
    processingTimeMs: number;
  };
}

export interface ExecuteResponse {
  success: boolean;
  sessionId: string;
  summary: {
    suppliers: { attempted: number; succeeded: number };
    materials: { attempted: number; succeeded: number };
    recipes: { attempted: number; succeeded: number };
    products: { attempted: number; succeeded: number };
    totalSucceeded: number;
  };
  error?: string;
  /** Why rows were not imported (capped server-side). */
  failures?: ImportFailure[];
  /** Rows with no name (blank lines, totals) that were left out. */
  skippedRows?: number;
}

export interface ImportFailure {
  entity: "supplier" | "material" | "recipe" | "product";
  /** 1-based row within that entity's rows; null when the whole group failed. */
  row: number | null;
  message: string;
}

export interface ImportSession {
  id: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  entityType: string | null;
  status: string;
  aiCallCount: number;
  totalTokens: number;
  processingTimeMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionsResponse {
  sessions: ImportSession[];
  stats: {
    totalSessions: number;
    completedSessions: number;
    failedSessions: number;
    totalRowsImported: number;
    totalTokensUsed: number;
  };
}

// ============================================================================
// Query Keys
// ============================================================================

export const aiImportKeys = {
  all: ["ai-import"] as const,
  sessions: (storeId: string) => [...aiImportKeys.all, "sessions", storeId] as const,
};

// ============================================================================
// Errors
// ============================================================================

/**
 * A failed import request. `timedOut` is true when the platform cut the
 * request off (a 504 / 408, or a gateway's HTML error page instead of the
 * route's JSON), which the dialog words differently from a refusal.
 */
export class ImportRequestError extends Error {
  constructor(
    message: string,
    readonly timedOut: boolean
  ) {
    super(message);
    this.name = "ImportRequestError";
  }
}

/**
 * The route's own reason for a failed response. These routes answer
 * `{ error, message }`; a timeout answers with a non-JSON page, and calling
 * `response.json()` on that used to throw "Unexpected token '<'" in place of
 * anything the merchant could act on.
 */
async function toImportError(response: Response, fallback: string): Promise<ImportRequestError> {
  const timedOut = response.status === 504 || response.status === 408;
  try {
    const body = await response.json();
    const reason =
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      fallback;
    return new ImportRequestError(reason, timedOut);
  } catch {
    return new ImportRequestError(fallback, timedOut || response.status >= 500);
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to analyze CSV with AI
 * Sends actual file as FormData (ChatGPT-style attachment)
 */
export function useAnalyzeImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      storeId: string;
      file: File; // Changed from csvContent: string
      entityType?: "material" | "product" | "supplier" | "recipe";
    }): Promise<AnalyzeResponse> => {
      // Create FormData to send file as binary attachment
      const formData = new FormData();
      formData.append("file", params.file);
      formData.append("storeId", params.storeId);
      formData.append("fileName", params.file.name);
      if (params.entityType) {
        formData.append("entityType", params.entityType);
      }

      const response = await fetch("/api/ai/import/analyze", {
        method: "POST",
        // Note: Do NOT set Content-Type header, browser sets it automatically with boundary
        body: formData,
      });

      if (!response.ok) throw await toImportError(response, "Analysis failed");

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate sessions to show new session
      queryClient.invalidateQueries({
        queryKey: aiImportKeys.sessions(variables.storeId),
      });
    },
  });
}

/**
 * Hook to execute the import with decisions
 */
export function useExecuteImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      storeId: string;
      entityType: "material" | "product" | "supplier" | "recipe";
      /** The type picked or detected in the dialog; omitted when it is unknown. */
      fallbackEntityType?: "material" | "product" | "supplier" | "recipe";
      data: Array<Record<string, unknown>>;
      decisions?: Array<{
        rowIndex: number;
        action: "IMPORT" | "SKIP" | "UPDATE" | "MERGE";
        targetId?: string;
        overrides?: Record<string, unknown>;
      }>;
      mappingCorrections?: Array<{
        sourceColumn: string;
        originalMapping: string;
        correctedMapping: string;
      }>;
    }): Promise<ExecuteResponse> => {
      const response = await fetch("/api/ai/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) throw await toImportError(response, "Import failed");

      return response.json();
    },
    onSuccess: async (_, variables) => {
      const { storeId } = variables;

      // Force immediate refetch of all entity queries after import
      // Using refetchQueries instead of invalidateQueries to ensure data appears immediately
      // (invalidateQueries only marks as stale, but may not trigger refetch if refetchOnMount: false)
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["materials", storeId] }),
        queryClient.refetchQueries({ queryKey: ["products", storeId] }),
        queryClient.refetchQueries({ queryKey: ["suppliers", storeId] }),
        queryClient.refetchQueries({ queryKey: ["recipes", storeId] }),
        // Invalidate sessions (these don't need immediate refetch)
        queryClient.invalidateQueries({ queryKey: aiImportKeys.sessions(storeId) }),
      ]);
    },
  });
}

/**
 * Hook to save user feedback/corrections
 */
export function useSaveFeedback() {
  return useMutation({
    mutationFn: async (params: {
      sessionId: string;
      storeId: string;
      entityType: "material" | "product" | "supplier" | "recipe";
      feedback: Array<{
        type:
          | "FIELD_MAPPING"
          | "TYPO_CORRECTION"
          | "CATEGORY_NORMALIZATION"
          | "UNIT_NORMALIZATION"
          | "SUPPLIER_ALIAS"
          | "MATERIAL_ALIAS";
        sourcePattern: string;
        aiSuggestion?: string;
        userCorrection: string;
        wasCorrect: boolean;
        memoryId?: string;
      }>;
    }) => {
      const response = await fetch("/api/ai/import/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save feedback");
      }

      return response.json();
    },
  });
}

/**
 * Hook to fetch import sessions history
 */
export function useImportSessions(storeId: string, options?: { limit?: number }) {
  return useQuery({
    queryKey: aiImportKeys.sessions(storeId),
    queryFn: async (): Promise<SessionsResponse> => {
      const params = new URLSearchParams({ storeId });
      if (options?.limit) {
        params.append("limit", String(options.limit));
      }

      const response = await fetch(`/api/ai/import/sessions?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to fetch sessions");
      }

      return response.json();
    },
    enabled: !!storeId,
  });
}
