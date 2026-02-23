import { NextResponse } from "next/server";

/**
 * Health check endpoint
 *
 * Returns basic health status for load balancers and monitoring.
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
  });
}
