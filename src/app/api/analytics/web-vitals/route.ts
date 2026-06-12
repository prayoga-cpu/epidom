import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Return 200 OK to acknowledge the report
  return NextResponse.json({ success: true });
}
