import type { Metadata } from "next";
import { BlogClient } from "./client";
export const metadata: Metadata = { title: "Blog — EPIDOM", description: "Guides, stories and tips for F&B owners from the Epidom team." };
export default function BlogPage() { return <BlogClient />; }
