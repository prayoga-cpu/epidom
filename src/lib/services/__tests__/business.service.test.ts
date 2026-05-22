import { describe, it, expect, vi, beforeEach, type MockedObject } from "vitest";
import { BusinessService } from "../business.service";
import type { BusinessRepository } from "@/lib/repositories/business.repository";
import { Prisma } from "@prisma/client";

const mockBusiness = {
  id: "biz-1",
  userId: "user-1",
  name: "Test Business",
  plan: "FREE",
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createMockRepository = (): MockedObject<BusinessRepository> =>
  ({
    findByUserId: vi.fn(),
    upsert: vi.fn(),
  }) as unknown as MockedObject<BusinessRepository>;

describe("BusinessService", () => {
  let service: BusinessService;
  let mockRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new BusinessService(mockRepo as unknown as BusinessRepository);
  });

  describe("getBusinessByUserId", () => {
    it("should return business when found", async () => {
      mockRepo.findByUserId.mockResolvedValue(mockBusiness as any);
      const result = await service.getBusinessByUserId("user-1");
      expect(result).toEqual(mockBusiness);
    });

    it("should return null if business not found", async () => {
      mockRepo.findByUserId.mockResolvedValue(null);
      const result = await service.getBusinessByUserId("unknown");
      expect(result).toBeNull();
    });
  });

  describe("upsertBusiness", () => {
    it("should call repository upsert with correct data", async () => {
      mockRepo.upsert.mockResolvedValue(mockBusiness as any);
      
      const input = {
        name: "Test Business",
      };
      
      const result = await service.upsertBusiness("user-1", input as any);
      
      expect(mockRepo.upsert).toHaveBeenCalledWith("user-1", input);
      expect(result).toEqual(mockBusiness);
    });
  });
});
