import { NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { withApiHandler } from "@/lib/api-handler";

export const POST = withApiHandler(
  async (request) => {
    try {
      const { name, themeColor } = await request.json();

      if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }

      const prompt = `
        Create a simple, modern, beautiful SVG logo for a food business named "${name}".
        The main brand color is ${themeColor || '#FF6B35'}.
        Return ONLY valid SVG code, no markdown, no wrapping. It should be a square viewBox="0 0 400 400".
        Use clean shapes, nice typography, and make it look professional.
      `;

      // Use a model, fallback to gemini-1.5-flash
      const { text } = await generateText({
        model: google("models/gemini-1.5-flash") as any,
        prompt,
      });

      // Cleanup response to ensure it's just SVG
      const cleanSvg = text.replace(/```xml|```svg|```/g, "").trim();

      return new NextResponse(cleanSvg, {
        headers: { "Content-Type": "image/svg+xml" },
      });
    } catch (error) {
      console.error("AI Logo Generation failed:", error);
      // Fallback
      return new NextResponse(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
          <rect width="400" height="400" fill="#FF6B35" />
          <text x="50%" y="50%" font-family="sans-serif" font-size="100" fill="white" text-anchor="middle" dominant-baseline="middle">LOGO</text>
        </svg>`,
        { headers: { "Content-Type": "image/svg+xml" } }
      );
    }
  },
  {}
);
