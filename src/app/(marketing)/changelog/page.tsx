import type { Metadata } from "next";
import { ChangelogClient } from "./client";
export const metadata: Metadata = { title: "Changelog — EPIDOM", description: "What's new in Epidom — product updates, fixes and improvements." };
export default function ChangelogPage() { return <ChangelogClient />; }
