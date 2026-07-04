import { Feedback, FeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inngest, type FeedbackSubmittedEventData } from "@/lib/inngest/client";
import { NotFoundError } from "@/lib/errors";
import { CreateFeedbackInput, UpdateOwnFeedbackInput } from "../validation/feedback.schemas";

/**
 * Feedback Service
 *
 * Business logic layer for user feedback (bug reports, feature suggestions).
 * Single-table feature - uses Prisma directly without a repository.
 */
export class FeedbackService {
  /**
   * Create feedback and fire a background notification event
   */
  async createFeedback(
    userId: string,
    userName: string,
    userEmail: string,
    input: CreateFeedbackInput
  ): Promise<Feedback> {
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

    const created = await prisma.feedback.create({
      data: {
        userId,
        userName,
        userEmail,
        storeId,
        type: input.type,
        page: input.page,
        description: input.description,
        screenshotUrl: input.screenshotUrl || null,
      },
    });

    // Fire background notification via Inngest (never fails creation)
    try {
      await inngest.send({
        name: "feedback/submitted",
        data: {
          feedbackId: created.id,
          type: input.type,
          page: input.page,
          description: input.description,
          screenshotUrl: input.screenshotUrl || null,
          userName,
          userEmail,
          storeId,
          storeName,
        } satisfies FeedbackSubmittedEventData,
      });
    } catch (error) {
      console.error("[feedback] Failed to send Inngest event:", error);
    }

    return created;
  }

  /**
   * Get feedback entries submitted by a user (ticket history)
   */
  async getUserFeedback(userId: string): Promise<Feedback[]> {
    return prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Update a feedback entry owned by the user
   *
   * Throws NotFoundError for both missing and non-owned entries
   * so existence is never leaked to other users.
   */
  async updateOwnFeedback(
    userId: string,
    id: string,
    input: UpdateOwnFeedbackInput
  ): Promise<Feedback> {
    await this.verifyOwnership(userId, id);

    return prisma.feedback.update({
      where: { id },
      data: {
        type: input.type,
        page: input.page,
        description: input.description,
      },
    });
  }

  /**
   * Delete a feedback entry owned by the user
   */
  async deleteOwnFeedback(userId: string, id: string): Promise<Feedback> {
    await this.verifyOwnership(userId, id);

    return prisma.feedback.delete({
      where: { id },
    });
  }

  /**
   * Ensure the feedback entry exists and belongs to the user
   */
  private async verifyOwnership(userId: string, id: string): Promise<void> {
    const existing = await prisma.feedback.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing || existing.userId !== userId) {
      throw new NotFoundError("Feedback");
    }
  }

  /**
   * Get all feedback entries (admin view)
   */
  async getAllFeedback() {
    return prisma.feedback.findMany({
      take: 500,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  /**
   * Update feedback status
   */
  async updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<Feedback> {
    return prisma.feedback.update({
      where: { id },
      data: { status },
    });
  }
}

// Export singleton instance
export const feedbackService = new FeedbackService();
