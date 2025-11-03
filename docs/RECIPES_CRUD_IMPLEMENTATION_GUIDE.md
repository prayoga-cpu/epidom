# Recipes CRUD Implementation Guide

**Status**: Recipe Repository ✅ Complete | Service & API ⏳ Pending

This guide provides step-by-step instructions for implementing full CRUD functionality for recipes, following the exact same pattern used for materials CRUD.

---

## Overview

### What's Already Done

✅ **Recipe Repository** - `src/lib/repositories/recipe.repository.ts` (COMPLETED)
✅ **All UI Components** - recipes-section.tsx, add/edit/details/duplicate dialogs (exist but use mock data)
✅ **Types & Validation** - Basic schemas exist in `src/lib/validation/inventory.schemas.ts`

### What Needs to Be Done

❌ **Recipe Service** - Business logic layer
❌ **API Routes** - 7 API endpoints
❌ **Validation Schemas** - Form variants and filter schemas
❌ **TanStack Query Hooks** - Data fetching layer
❌ **Component Updates** - Connect UI to real API (5 components)

---

## Phase 1: Recipe Service

### File to Create: `src/lib/services/recipe.service.ts`

**Reference Pattern**: `src/lib/services/material.service.ts`

#### Key Methods to Implement:

```typescript
import { Recipe } from "@prisma/client";
import {
  recipeRepository,
  RecipeRepository,
  RecipeWithIngredients,
  RecipeFilters,
} from "@/lib/repositories/recipe.repository";
import { prisma } from "@/lib/prisma";

export interface CreateRecipeInput {
  storeId: string;
  name: string;
  description?: string;
  category?: string;
  yieldQuantity: number;
  yieldUnit: string;
  productionTimeMinutes: number;
  instructions?: string;
  ingredients?: Array<{
    materialId: string;
    quantity: number;
    unit: string;
    notes?: string;
  }>;
}

export interface UpdateRecipeInput {
  name?: string;
  description?: string;
  category?: string;
  yieldQuantity?: number;
  yieldUnit?: string;
  productionTimeMinutes?: number;
  instructions?: string;
  ingredients?: Array<{
    materialId: string;
    quantity: number;
    unit: string;
    notes?: string;
  }>;
}

export class RecipeService {
  constructor(private readonly recipeRepo: RecipeRepository = recipeRepository) {}

  // 1. Get all recipes with filtering
  async getRecipes(storeId: string, filters: RecipeFilters = {}) {
    return this.recipeRepo.findAll(storeId, filters);
  }

  // 2. Get recipe by ID
  async getRecipeById(recipeId: string) {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) throw new Error("Recipe not found");
    return recipe;
  }

  // 3. Create recipe
  async createRecipe(input: CreateRecipeInput) {
    // Check name uniqueness
    const nameExists = await this.recipeRepo.existsByName(input.storeId, input.name);
    if (nameExists) {
      throw new Error("A recipe with this name already exists in your store");
    }

    // Validate ingredients exist
    if (input.ingredients && input.ingredients.length > 0) {
      const materialIds = input.ingredients.map((i) => i.materialId);
      const materials = await prisma.ingredient.findMany({
        where: { id: { in: materialIds }, storeId: input.storeId },
      });

      if (materials.length !== materialIds.length) {
        throw new Error("Some ingredients do not exist or don't belong to this store");
      }
    }

    return this.recipeRepo.create(input);
  }

  // 4. Update recipe
  async updateRecipe(recipeId: string, storeId: string, input: UpdateRecipeInput) {
    // Verify ownership
    const belongsToStore = await this.recipeRepo.belongsToStore(recipeId, storeId);
    if (!belongsToStore) {
      throw new Error("Recipe does not belong to this store");
    }

    // Check name uniqueness if changing
    if (input.name) {
      const nameExists = await this.recipeRepo.existsByName(storeId, input.name, recipeId);
      if (nameExists) {
        throw new Error("A recipe with this name already exists in your store");
      }
    }

    // If updating ingredients, handle separately
    if (input.ingredients) {
      // Delete all existing ingredients
      await prisma.recipeIngredient.deleteMany({
        where: { recipeId },
      });

      // Add new ingredients (will auto-recalculate cost)
      for (const ing of input.ingredients) {
        await this.recipeRepo.addIngredient(
          recipeId,
          ing.materialId,
          ing.quantity,
          ing.unit,
          ing.notes
        );
      }

      // Update recipe basic info without ingredients
      const { ingredients, ...updateData } = input;
      return this.recipeRepo.update(recipeId, updateData);
    }

    return this.recipeRepo.update(recipeId, input);
  }

  // 5. Delete recipe
  async deleteRecipe(recipeId: string, storeId: string) {
    // Verify ownership
    const belongsToStore = await this.recipeRepo.belongsToStore(recipeId, storeId);
    if (!belongsToStore) {
      throw new Error("Recipe does not belong to this store");
    }

    // Check if used in products
    const productCount = await prisma.product.count({
      where: { recipeId },
    });

    if (productCount > 0) {
      throw new Error(
        `Cannot delete recipe because it is used in ${productCount} product(s). Please unlink products first.`
      );
    }

    await this.recipeRepo.delete(recipeId);
  }

  // 6. Bulk delete recipes
  async bulkDeleteRecipes(recipeIds: string[], storeId: string) {
    // Verify all belong to store
    const recipes = await this.recipeRepo.findByIds(recipeIds);
    const invalidRecipes = recipes.filter((r) => r.storeId !== storeId);
    if (invalidRecipes.length > 0) {
      throw new Error("Some recipes do not belong to this store");
    }

    // Check if any used in products
    const productCount = await prisma.product.count({
      where: { recipeId: { in: recipeIds } },
    });

    if (productCount > 0) {
      throw new Error(
        "Cannot delete recipes because some are used in products. Please unlink products first."
      );
    }

    return this.recipeRepo.bulkDelete(recipeIds);
  }

  // 7. Duplicate recipe
  async duplicateRecipe(recipeId: string, storeId: string, newName?: string) {
    // Verify ownership
    const belongsToStore = await this.recipeRepo.belongsToStore(recipeId, storeId);
    if (!belongsToStore) {
      throw new Error("Recipe does not belong to this store");
    }

    const originalRecipe = await this.recipeRepo.findById(recipeId);
    if (!originalRecipe) {
      throw new Error("Recipe not found");
    }

    // Generate unique name
    const duplicateName = newName || `${originalRecipe.name} (Copy)`;

    // Check if name exists
    const nameExists = await this.recipeRepo.existsByName(storeId, duplicateName);
    if (nameExists) {
      throw new Error("A recipe with this name already exists");
    }

    return this.recipeRepo.duplicate(recipeId, duplicateName, storeId);
  }

  // 8. Export recipes to CSV
  async exportRecipesToCSV(storeId: string, filters: RecipeFilters = {}) {
    const { recipes } = await this.recipeRepo.findAll(storeId, filters);

    // CSV header
    const headers = [
      "Name",
      "Category",
      "Yield Quantity",
      "Yield Unit",
      "Production Time (min)",
      "Cost Per Batch",
      "Cost Per Unit",
      "Ingredients Count",
      "Description",
    ];

    // CSV rows
    const rows = recipes.map((recipe) => [
      recipe.name,
      recipe.category || "",
      recipe.yieldQuantity.toString(),
      recipe.yieldUnit,
      recipe.productionTimeMinutes.toString(),
      recipe.costPerBatch.toString(),
      recipe.costPerUnit.toString(),
      recipe.ingredients.length.toString(),
      (recipe.description || "").replace(/"/g, '""'), // Escape quotes
    ]);

    // Build CSV
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    return csvContent;
  }

  // 9. Recalculate recipe cost (when material prices change)
  async recalculateRecipeCost(recipeId: string) {
    await this.recipeRepo.recalculateCost(recipeId);
  }
}

// Export singleton instance
export const recipeService = new RecipeService();
```

**Important Notes**:

- Always verify store ownership before mutations
- Check if recipe is used in products before deletion
- Validate ingredients belong to the same store
- Handle ingredient array updates atomically
- Auto-recalculate costs when ingredients change

---

## Phase 2: Validation Schemas

### File to Modify: `src/lib/validation/inventory.schemas.ts`

Add these schemas after the existing recipe schemas (around line 200):

```typescript
// Recipe ingredient schema for arrays
export const recipeIngredientSchema = z.object({
  materialId: cuidSchema,
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unit: z.string().min(1, "Unit is required").max(20),
  notes: z.string().max(500).optional(),
});

// Form schema for client-side (without storeId)
export const createRecipeFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  description: z.string().max(1000).optional(),
  category: z.string().min(1, "Category is required").max(100),
  yieldQuantity: z.coerce.number().positive("Yield quantity must be positive"),
  yieldUnit: z.string().min(1, "Yield unit is required").max(20),
  productionTimeMinutes: z.coerce.number().positive("Production time must be positive"),
  instructions: z.string().min(10, "Instructions must be at least 10 characters").optional(),
  ingredients: z.array(recipeIngredientSchema).min(1, "At least one ingredient is required"),
});

export type CreateRecipeFormInput = z.infer<typeof createRecipeFormSchema>;

// Update form schema (all fields optional except ingredients array structure)
export const updateRecipeFormSchema = createRecipeFormSchema.partial();

export type UpdateRecipeFormInput = z.infer<typeof updateRecipeFormSchema>;

// Filter schema for query params
export const recipeFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sortBy: z
    .enum(["name", "category", "productionTimeMinutes", "costPerBatch", "createdAt", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  skip: z.coerce.number().int().nonnegative().default(0),
  take: z.coerce.number().int().positive().max(100).default(50),
});

export type RecipeFilterInput = z.infer<typeof recipeFilterSchema>;
```

---

## Phase 3: API Routes

### 1. Create: `src/app/api/stores/[id]/recipes/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { createRecipeSchema, recipeFilterSchema } from "@/lib/validation/inventory.schemas";
import { ApiErrorResponse, ApiSuccessResponse } from "@/types/api/responses";

// GET /api/stores/[id]/recipes - List recipes
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const storeId = params.id;
    const searchParams = request.nextUrl.searchParams;

    // Parse and validate filters
    const filters = recipeFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
      skip: parseInt(searchParams.get("skip") || "0"),
      take: parseInt(searchParams.get("take") || "50"),
    });

    const result = await recipeService.getRecipes(storeId, filters);

    return NextResponse.json<ApiSuccessResponse<typeof result>>(
      { success: true, data: result },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching recipes:", error);
    return NextResponse.json<ApiErrorResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch recipes",
        },
      },
      { status: 500 }
    );
  }
}

// POST /api/stores/[id]/recipes - Create recipe
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const storeId = params.id;
    const body = await request.json();

    // Validate input
    const validatedData = createRecipeSchema.parse({
      storeId,
      ...body,
    });

    const recipe = await recipeService.createRecipe(validatedData);

    return NextResponse.json<ApiSuccessResponse<typeof recipe>>(
      { success: true, data: recipe },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating recipe:", error);

    if (error instanceof Error && error.message.includes("already exists")) {
      return NextResponse.json<ApiErrorResponse>(
        {
          success: false,
          error: { code: "CONFLICT", message: error.message },
        },
        { status: 409 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to create recipe",
        },
      },
      { status: 500 }
    );
  }
}
```

### 2. Create: `src/app/api/stores/[id]/recipes/[recipeId]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { updateRecipeSchema } from "@/lib/validation/inventory.schemas";
import { ApiErrorResponse, ApiSuccessResponse } from "@/types/api/responses";

// GET /api/stores/[id]/recipes/[recipeId] - Get single recipe
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; recipeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const recipe = await recipeService.getRecipeById(params.recipeId);

    return NextResponse.json<ApiSuccessResponse<typeof recipe>>(
      { success: true, data: recipe },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Recipe not found") {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch recipe",
        },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/stores/[id]/recipes/[recipeId] - Update recipe
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; recipeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const storeId = params.id;
    const recipeId = params.recipeId;
    const body = await request.json();

    const validatedData = updateRecipeSchema.parse(body);

    const recipe = await recipeService.updateRecipe(recipeId, storeId, validatedData);

    return NextResponse.json<ApiSuccessResponse<typeof recipe>>(
      { success: true, data: recipe },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not belong")) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "FORBIDDEN", message: error.message } },
        { status: 403 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to update recipe",
        },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/stores/[id]/recipes/[recipeId] - Delete recipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; recipeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    await recipeService.deleteRecipe(params.recipeId, params.id);

    return NextResponse.json<ApiSuccessResponse<{ message: string }>>(
      { success: true, data: { message: "Recipe deleted successfully" } },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("used in")) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete recipe",
        },
      },
      { status: 500 }
    );
  }
}
```

### 3. Create: `src/app/api/stores/[id]/recipes/[recipeId]/duplicate/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { z } from "zod";
import { ApiErrorResponse, ApiSuccessResponse } from "@/types/api/responses";

const duplicateSchema = z.object({
  newName: z.string().min(2).max(200).optional(),
});

// POST /api/stores/[id]/recipes/[recipeId]/duplicate
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; recipeId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { newName } = duplicateSchema.parse(body);

    const recipe = await recipeService.duplicateRecipe(params.recipeId, params.id, newName);

    return NextResponse.json<ApiSuccessResponse<typeof recipe>>(
      { success: true, data: recipe },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to duplicate recipe",
        },
      },
      { status: 500 }
    );
  }
}
```

### 4. Create: `src/app/api/stores/[id]/recipes/bulk/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { bulkDeleteSchema } from "@/lib/validation/inventory.schemas";
import { ApiErrorResponse, ApiSuccessResponse } from "@/types/api/responses";

// DELETE /api/stores/[id]/recipes/bulk
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { ids } = bulkDeleteSchema.parse(body);

    const deletedCount = await recipeService.bulkDeleteRecipes(ids, params.id);

    return NextResponse.json<ApiSuccessResponse<{ message: string; deletedCount: number }>>(
      {
        success: true,
        data: {
          message: `Successfully deleted ${deletedCount} recipe(s)`,
          deletedCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("used in")) {
      return NextResponse.json<ApiErrorResponse>(
        { success: false, error: { code: "CONFLICT", message: error.message } },
        { status: 409 }
      );
    }

    return NextResponse.json<ApiErrorResponse>(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete recipes",
        },
      },
      { status: 500 }
    );
  }
}
```

### 5. Create: `src/app/api/stores/[id]/recipes/export/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recipeService } from "@/lib/services/recipe.service";
import { recipeFilterSchema } from "@/lib/validation/inventory.schemas";

// GET /api/stores/[id]/recipes/export
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const storeId = params.id;
    const searchParams = request.nextUrl.searchParams;

    const filters = recipeFilterSchema.parse({
      search: searchParams.get("search") || undefined,
      category: searchParams.get("category") || undefined,
      sortBy: searchParams.get("sortBy") || "createdAt",
      sortOrder: searchParams.get("sortOrder") || "desc",
    });

    const csv = await recipeService.exportRecipesToCSV(storeId, filters);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="recipes-${storeId}-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting recipes:", error);
    return new NextResponse("Failed to export recipes", { status: 500 });
  }
}
```

---

## Phase 4: TanStack Query Hooks

### File to Create: `src/features/dashboard/data/recipes/hooks/use-recipes.ts`

**Reference**: `src/features/dashboard/data/materials/hooks/use-materials.ts`

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreateRecipeFormInput,
  UpdateRecipeFormInput,
  RecipeFilterInput,
  BulkDeleteInput,
} from "@/lib/validation/inventory.schemas";
import { ApiSuccessResponse } from "@/types/api/responses";
import { Recipe } from "@/types/entities";

// Recipe type with ingredients
export interface RecipeWithIngredients extends Recipe {
  ingredients: Array<{
    id: string;
    recipeId: string;
    materialId: string;
    quantity: number;
    unit: string;
    notes: string | null;
    material: {
      id: string;
      name: string;
      unit: string;
      unitCost: number;
      currentStock: number;
    };
  }>;
}

export interface RecipesResponse {
  recipes: RecipeWithIngredients[];
  total: number;
}

// Query keys
export const recipeKeys = {
  all: (storeId: string) => ["recipes", storeId] as const,
  lists: (storeId: string) => [...recipeKeys.all(storeId), "list"] as const,
  list: (storeId: string, filters?: RecipeFilterInput) =>
    [...recipeKeys.lists(storeId), filters] as const,
  details: (storeId: string) => [...recipeKeys.all(storeId), "detail"] as const,
  detail: (storeId: string, id: string) => [...recipeKeys.details(storeId), id] as const,
};

/**
 * Fetch all recipes for a store
 */
export function useRecipes(storeId: string, filters?: RecipeFilterInput) {
  return useQuery<RecipesResponse>({
    queryKey: recipeKeys.list(storeId, filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }

      const queryString = params.toString();
      const url = `/api/stores/${storeId}/recipes${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch recipes");
      }

      const data: ApiSuccessResponse<RecipesResponse> = await response.json();
      return data.data;
    },
    enabled: !!storeId,
  });
}

/**
 * Fetch single recipe by ID
 */
export function useRecipe(storeId: string, id: string) {
  return useQuery<RecipeWithIngredients>({
    queryKey: recipeKeys.detail(storeId, id),
    queryFn: async () => {
      const response = await fetch(`/api/stores/${storeId}/recipes/${id}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch recipe");
      }

      const data: ApiSuccessResponse<RecipeWithIngredients> = await response.json();
      return data.data;
    },
    enabled: !!storeId && !!id,
  });
}

/**
 * Create a new recipe
 */
export function useCreateRecipe(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<RecipeWithIngredients, Error, CreateRecipeFormInput>({
    mutationFn: async (input) => {
      const response = await fetch(`/api/stores/${storeId}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to create recipe");
      }

      const data: ApiSuccessResponse<RecipeWithIngredients> = await response.json();
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists(storeId) });
    },
  });
}

/**
 * Update a recipe
 */
export function useUpdateRecipe(storeId: string, id: string) {
  const queryClient = useQueryClient();

  return useMutation<Recipe, Error, UpdateRecipeFormInput>({
    mutationFn: async (input) => {
      const response = await fetch(`/api/stores/${storeId}/recipes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to update recipe");
      }

      const data: ApiSuccessResponse<Recipe> = await response.json();
      return data.data;
    },
    onSuccess: (updatedRecipe) => {
      queryClient.setQueryData(recipeKeys.detail(storeId, id), updatedRecipe);
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists(storeId) });
    },
  });
}

/**
 * Delete a recipe
 */
export function useDeleteRecipe(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/stores/${storeId}/recipes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to delete recipe");
      }

      const data: ApiSuccessResponse<{ message: string }> = await response.json();
      return data.data;
    },
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: recipeKeys.detail(storeId, deletedId) });
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists(storeId) });
    },
  });
}

/**
 * Bulk delete recipes
 */
export function useBulkDeleteRecipes(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string; deletedCount: number }, Error, BulkDeleteInput>({
    mutationFn: async (input) => {
      const response = await fetch(`/api/stores/${storeId}/recipes/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to delete recipes");
      }

      const data: ApiSuccessResponse<{ message: string; deletedCount: number }> =
        await response.json();
      return data.data;
    },
    onSuccess: (_, { ids }) => {
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: recipeKeys.detail(storeId, id) });
      });
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists(storeId) });
    },
  });
}

/**
 * Duplicate a recipe
 */
export function useDuplicateRecipe(storeId: string) {
  const queryClient = useQueryClient();

  return useMutation<RecipeWithIngredients, Error, { recipeId: string; newName?: string }>({
    mutationFn: async ({ recipeId, newName }) => {
      const response = await fetch(`/api/stores/${storeId}/recipes/${recipeId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to duplicate recipe");
      }

      const data: ApiSuccessResponse<RecipeWithIngredients> = await response.json();
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipeKeys.lists(storeId) });
    },
  });
}

/**
 * Export recipes to CSV
 */
export function useExportRecipes(storeId: string) {
  return useMutation<Blob, Error, RecipeFilterInput | undefined>({
    mutationFn: async (filters) => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            params.append(key, String(value));
          }
        });
      }

      const queryString = params.toString();
      const url = `/api/stores/${storeId}/recipes/export${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to export recipes");
      }

      return response.blob();
    },
    onSuccess: (blob) => {
      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recipes-${storeId}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
  });
}
```

---

## Phase 5: Component Updates

### Components to Update (in order):

1. **recipes-section.tsx** - Main list view
2. **add-recipe-dialog.tsx** - Create dialog
3. **edit-recipe-dialog.tsx** - Edit dialog
4. **recipe-details-dialog.tsx** - Details view
5. **duplicate-recipe-dialog.tsx** - Duplicate functionality

### Key Changes for Each Component:

#### 1. `recipes-section.tsx` Updates:

**Remove:**

```typescript
import { MOCK_RECIPES } from "@/mocks";
const recipes = MOCK_RECIPES;
```

**Add:**

```typescript
import { useRecipes, useDeleteRecipe, useBulkDeleteRecipes, useExportRecipes } from "../hooks/use-recipes";
import { toast } from "sonner";
import { useParams } from "next/navigation";

const params = useParams();
const storeId = params.storeId as string;

const [filters, setFilters] = useState({
  search: "",
  category: "",
  sortBy: "createdAt" as const,
  sortOrder: "desc" as const,
  skip: 0,
  take: 50,
});

const { data, isLoading, error, refetch } = useRecipes(storeId, filters);
const recipes = data?.recipes || [];
const total = data?.total || 0;

const deleteRecipe = useDeleteRecipe(storeId);
const bulkDelete = useBulkDeleteRecipes(storeId);
const exportRecipes = useExportRecipes(storeId);

// Add loading state
if (isLoading) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

// Add error state
if (error) {
  return (
    <div className="border-destructive rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="text-destructive h-5 w-5" />
        <p className="text-destructive text-sm">Error loading recipes: {error.message}</p>
      </div>
      <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">
        Retry
      </Button>
    </div>
  );
}

// Update delete handler
const handleDeleteConfirm = async () => {
  if (!selectedRecipe) return;
  try {
    await deleteRecipe.mutateAsync(selectedRecipe.id);
    toast.success("Recipe deleted successfully");
    setDeleteDialogOpen(false);
    setSelectedRecipe(null);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to delete recipe");
  }
};

// Update bulk delete handler
const handleBulkDelete = async () => {
  if (selectedIds.size === 0) return;
  try {
    await bulkDelete.mutateAsync({ ids: Array.from(selectedIds) });
    toast.success(`Deleted ${selectedIds.size} recipe(s) successfully`);
    setSelectedIds(new Set());
    setBulkSelectMode(false);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to delete recipes");
  }
};

// Update export handler
const handleExport = async () => {
  try {
    await exportRecipes.mutateAsync(filters);
  } catch (error) {
    toast.error("Failed to export recipes");
  }
};
```

#### 2. `add-recipe-dialog.tsx` Updates:

**Remove:**

```typescript
import { MOCK_MATERIALS } from "@/mocks";
const materials = MOCK_MATERIALS;

// Remove setTimeout simulation
setTimeout(() => {
  toast.success("Recipe created!");
  setOpen(false);
}, 1000);
```

**Add:**

```typescript
import { useCreateRecipe } from "../hooks/use-recipes";
import { useMaterials } from "../../materials/hooks/use-materials";
import { toast } from "sonner";
import { useParams } from "next/navigation";

const params = useParams();
const storeId = params.storeId as string;

// Fetch real materials for dropdown
const { data: materialsData } = useMaterials(storeId);
const materials = materialsData?.materials || [];

const createRecipe = useCreateRecipe(storeId);

const onSubmit = async (data: CreateRecipeFormInput) => {
  try {
    await createRecipe.mutateAsync(data);
    toast.success("Recipe created successfully!");
    setOpen(false);
    form.reset();
    setCurrentStep(0);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to create recipe");
  }
};
```

#### 3. `edit-recipe-dialog.tsx` Updates:

**Add:**

```typescript
import { useUpdateRecipe } from "../hooks/use-recipes";
import { toast } from "sonner";
import { useParams } from "next/navigation";

const params = useParams();
const storeId = params.storeId as string;
const recipeId = recipe?.id || "";

const updateRecipe = useUpdateRecipe(storeId, recipeId);

const onSubmit = async (data: UpdateRecipeFormInput) => {
  if (!recipe) return;

  try {
    await updateRecipe.mutateAsync(data);
    toast.success("Recipe updated successfully!");
    onOpenChange(false);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to update recipe");
  }
};
```

#### 4. `recipe-details-dialog.tsx` Updates:

**Remove:**

```typescript
import { MOCK_MATERIALS, MOCK_PRODUCTS } from "@/mocks";
```

**Add:**

```typescript
// Ingredients are already included in recipe.ingredients from the query
// Just use recipe.ingredients instead of MOCK_MATERIALS

// For products using this recipe, add a query:
import { useQuery } from "@tanstack/react-query";

const { data: productsData } = useQuery({
  queryKey: ["products", storeId, "by-recipe", recipe?.id],
  queryFn: async () => {
    if (!recipe?.id) return [];
    const response = await fetch(`/api/stores/${storeId}/products?recipeId=${recipe.id}`);
    const data = await response.json();
    return data.data.products;
  },
  enabled: !!recipe?.id && !!storeId,
});

const productsUsingRecipe = productsData || [];
```

#### 5. `duplicate-recipe-dialog.tsx` Updates:

**Add complete implementation:**

```typescript
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useDuplicateRecipe } from "../hooks/use-recipes";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const duplicateSchema = z.object({
  newName: z.string().min(2, "Name must be at least 2 characters").max(200),
});

interface DuplicateRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: { id: string; name: string } | null;
}

export default function DuplicateRecipeDialog({
  open,
  onOpenChange,
  recipe,
}: DuplicateRecipeDialogProps) {
  const params = useParams();
  const storeId = params.storeId as string;

  const duplicateRecipe = useDuplicateRecipe(storeId);

  const form = useForm({
    resolver: zodResolver(duplicateSchema),
    defaultValues: {
      newName: recipe ? `${recipe.name} (Copy)` : "",
    },
  });

  useEffect(() => {
    if (recipe) {
      form.reset({ newName: `${recipe.name} (Copy)` });
    }
  }, [recipe, form]);

  const onSubmit = async (data: { newName: string }) => {
    if (!recipe) return;

    try {
      await duplicateRecipe.mutateAsync({
        recipeId: recipe.id,
        newName: data.newName,
      });
      toast.success("Recipe duplicated successfully!");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate recipe");
    }
  };

  if (!recipe) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicate Recipe</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Recipe Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter new recipe name" />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={duplicateRecipe.isPending}>
                {duplicateRecipe.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Duplicate
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Testing Checklist

### Backend Tests:

- [ ] Create recipe with ingredients
- [ ] Create recipe with no ingredients (should fail)
- [ ] Update recipe basic info
- [ ] Update recipe ingredients
- [ ] Delete recipe (check if used in products)
- [ ] Bulk delete recipes
- [ ] Duplicate recipe
- [ ] Export recipes to CSV
- [ ] Filter by category
- [ ] Search by name
- [ ] Sort by different fields

### Frontend Tests:

- [ ] Load recipes list
- [ ] Search recipes
- [ ] Filter by category
- [ ] Sort recipes
- [ ] Create recipe (multi-step wizard)
- [ ] Edit recipe
- [ ] View recipe details
- [ ] Delete recipe
- [ ] Bulk delete
- [ ] Duplicate recipe
- [ ] Export recipes
- [ ] Error handling displays properly

---

## Common Issues & Solutions

### Issue: "Expected number but got string" validation error

**Solution**: Use `parseFloat()` in input onChange handlers:

```typescript
<Input
  type="number"
  {...field}
  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
/>
```

### Issue: Route parameter mismatch

**Solution**: Check route structure - materials uses `[id]` not `[storeId]`:

```typescript
// In data page route: /store/[storeId]/(dashboard)/data
const params = useParams();
const storeId = params.storeId as string; // Correct for data page context
```

### Issue: Ingredients not populating in edit dialog

**Solution**: Map `ingredients` array correctly in useEffect:

```typescript
useEffect(() => {
  if (recipe) {
    form.reset({
      ...basicFields,
      ingredients: recipe.ingredients.map((ing) => ({
        materialId: ing.materialId,
        quantity: Number(ing.quantity),
        unit: ing.unit,
        notes: ing.notes || "",
      })),
    });
  }
}, [recipe, form]);
```

---

## Summary

**Total Files to Create**: 9
**Total Files to Modify**: 7
**Estimated Time**: 24-32 hours

**Implementation Order**:

1. Recipe Service (2-3 hours)
2. Validation Schemas (30 min)
3. API Routes (4-6 hours)
4. TanStack Query Hooks (2-3 hours)
5. Component Updates (4-6 hours each)
6. Testing (4-6 hours)

**Success Criteria**:

- All CRUD operations work without errors
- No TypeScript errors
- Loading/error states display correctly
- Optimistic updates work smoothly
- CSV export generates correctly
- Duplicate recipe copies all ingredients
- Product usage prevents deletion

**Don't ever change the UI style, if you want to change ask me first**
