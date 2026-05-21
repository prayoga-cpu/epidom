import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { withApiHandler } from "@/lib/api-handler";

export const POST = withApiHandler(
  async (request) => {
    try {
      const { name, tagline } = await request.json();

      if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }

      const prompt = `
        You are an AI assistant helping a small food business in Indonesia create their initial menu.
        The business name is "${name}" and their tagline is "${tagline || 'Unknown'}".
        Suggest exactly 3 popular, delicious, and relevant menu items with realistic prices in Indonesian Rupiah (IDR).
        Keep names authentic and prices standard for small-to-medium F&B in Indonesia (warung, cafe, resto).
      `;

      const { object } = await generateObject({
        model: google("models/gemini-1.5-flash") as any,
        schema: z.object({
          items: z.array(
            z.object({
              name: z.string(),
              price: z.number().describe("Price in IDR (e.g. 15000, 25000)"),
            })
          ).length(3),
        }),
        prompt,
      });

      return NextResponse.json({ data: object.items });
    } catch (error) {
      console.error("AI Menu Suggestion failed:", error);
      // Fallback
      return NextResponse.json({
        data: [
          { name: "Nasi Goreng Spesial", price: 25000 },
          { name: "Es Teh Manis", price: 5000 },
          { name: "Kerupuk Udang", price: 3000 }
        ]
      });
    }
  },
  {}
);
