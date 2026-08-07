/**
 * Vitest Test Setup
 *
 * Global test configuration and mocks.
 * This file runs before each test file.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// jsdom doesn't implement matchMedia — needed by usePwaInstall()'s
// standalone-display-mode detection, which NotificationBell now pulls in
// transitively via usePushNotifications().
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Prisma client for unit tests
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((fn) => fn(mockPrismaValues)),
    material: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    recipe: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    stockMovement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    recipeIngredient: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    materialSupplier: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    store: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    supplier: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Expose mock prisma for transaction testing
const mockPrismaValues = {
  material: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  stockMovement: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  recipeIngredient: {
    deleteMany: vi.fn(),
  },
  materialSupplier: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
};

// Mock logger to avoid console noise in tests
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Global test helpers
declare global {
  var mockPrisma: typeof mockPrismaValues;
}

globalThis.mockPrisma = mockPrismaValues;
