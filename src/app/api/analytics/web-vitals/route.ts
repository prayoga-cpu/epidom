import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Parsing the body is optional if we just want to acknowledge receipt
  // const body = await request.json();
  // console.log("Web Vitals:", body);

  // Return 200 OK to acknowledge the report
  return NextResponse.json({ success: true });
}
