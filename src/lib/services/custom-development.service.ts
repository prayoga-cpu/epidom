import { CustomDevelopmentRequest, CustomDevelopmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inngest, type CustomDevelopmentSubmittedEventData } from "@/lib/inngest/client";
import { NotFoundError } from "@/lib/errors";
import {
  CreateCustomDevelopmentRequestInput,
  UpdateOwnCustomDevelopmentRequestInput,
} from "../validation/custom-development.schemas";

/**
 * Custom Development Request Service
 *
 * Business logic layer for Enterprise "Custom Development" requests.
 * Single-table feature - uses Prisma directly without a repository.
 */
export class CustomDevelopmentService {
  /**
   * Create a request and fire a background notification event
   */
  async createRequest(
    userId: string,
    userName: string,
    userEmail: string,
    input: CreateCustomDevelopmentRequestInput
  ): Promise<CustomDevelopmentRequest> {
    // Resolve store context, keeping it only if the store belongs to the user
    let storeId: string | null = null;
    let storeName: string | null = null;

    if (input.storeId) {
      const store = await prisma.store.findUnique({
        where: { id: input.storeId },
        select: { name: true, business: { select: { userId: true } } },
      });

      if (store && store.business.userId === userId) {
        storeId = input.storeId;
        storeName = store.name;
      }
    }

    const created = await prisma.customDevelopmentRequest.create({
      data: {
        userId,
        userName,
        userEmail,
        storeId,
        company: input.company || null,
        phone: input.phone || null,
        budget: input.budget || null,
        timeline: input.timeline || null,
        description: input.description,
      },
    });

    // Fire background notification via Inngest (never fails creation)
    try {
      await inngest.send({
        name: "custom-development/submitted",
        data: {
          requestId: created.id,
          description: input.description,
          company: input.company || null,
          phone: input.phone || null,
          budget: input.budget || null,
          timeline: input.timeline || null,
          userName,
          userEmail,
          storeId,
          storeName,
        } satisfies CustomDevelopmentSubmittedEventData,
      });
    } catch (error) {
      console.error("[custom-development] Failed to send Inngest event:", error);
    }

    return created;
  }

  /**
   * Get requests submitted by a user (their own submission history)
   */
  async getUserRequests(userId: string): Promise<CustomDevelopmentRequest[]> {
    return prisma.customDevelopmentRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Update a request owned by the user
   *
   * Throws NotFoundError for both missing and non-owned entries so
   * existence is never leaked to other users.
   */
  async updateOwnRequest(
    userId: string,
    id: string,
    input: UpdateOwnCustomDevelopmentRequestInput
  ): Promise<CustomDevelopmentRequest> {
    await this.verifyOwnership(userId, id);

    return prisma.customDevelopmentRequest.update({
      where: { id },
      data: {
        company: input.company || null,
        phone: input.phone || null,
        budget: input.budget || null,
        timeline: input.timeline || null,
        description: input.description,
      },
    });
  }

  /**
   * Delete a request owned by the user
   */
  async deleteOwnRequest(userId: string, id: string): Promise<CustomDevelopmentRequest> {
    await this.verifyOwnership(userId, id);

    return prisma.customDevelopmentRequest.delete({
      where: { id },
    });
  }

  /**
   * Ensure the request exists and belongs to the user
   */
  private async verifyOwnership(userId: string, id: string): Promise<void> {
    const existing = await prisma.customDevelopmentRequest.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundError("CustomDevelopmentRequest");
    }
  }

  /**
   * Get all requests (admin view)
   */
  async getAllRequests() {
    return prisma.customDevelopmentRequest.findMany({
      take: 500,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  /**
   * Count requests still awaiting a first admin look (admin badge count)
   */
  async getNewRequestCount(): Promise<number> {
    return prisma.customDevelopmentRequest.count({ where: { status: "NEW" } });
  }

  /**
   * Update request status and/or dev note (admin triage)
   */
  async updateTriage(
    id: string,
    data: { status?: CustomDevelopmentStatus; devNote?: string }
  ): Promise<CustomDevelopmentRequest> {
    const existing = await prisma.customDevelopmentRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundError("CustomDevelopmentRequest");
    }

    return prisma.customDevelopmentRequest.update({
      where: { id },
      data,
    });
  }
}

// Export singleton instance
export const customDevelopmentService = new CustomDevelopmentService();
