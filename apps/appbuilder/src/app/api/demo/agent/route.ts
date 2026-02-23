/**
 * ============================================
 * DEMO FILE - DELETE WHEN BUILDING REAL APP
 * ============================================
 * 
 * This file is part of the busibox-template demo.
 * Delete this entire file when starting your real app.
 * 
 * See DEMO.md for complete deletion checklist.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithTokenExchange } from "@jazzmind/busibox-app/lib/next/middleware";

/**
 * POST /api/demo/agent
 * Demo endpoint that calls the agent-api to test token exchange and chat
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, "agent-api");
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    // Determine agent API URL
    // Note: In Docker/production, this is usually http://agent-api:8000 (internal DNS)
    const agentApiUrl =
      process.env.DEMO_AGENT_API_URL ||
      process.env.AGENT_API_URL ||
      "http://agent-api:8000";

    const startTime = Date.now();

    // Call agent-api legacy chat endpoint
    // The legacy endpoint is at /chat/api/chat (router prefix /chat + endpoint /api/chat)
    // It expects { message: string, agentId?: string } format
    const response = await fetch(`${agentApiUrl}/chat/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        agentId: "default",
      }),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[DEMO] Agent API error:", response.status, errorText);
      
      // Try to parse error as JSON for better messages
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.message || errorText;
      } catch {
        // Keep original error text
      }
      
      return NextResponse.json(
        {
          error: "Agent API call failed",
          status: response.status,
          message: errorMessage,
          duration,
          agentApiUrl,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    // The legacy endpoint returns { response: string, success: boolean }
    const assistantMessage = data.response || 
                            data.choices?.[0]?.message?.content || 
                            data.message?.content ||
                            JSON.stringify(data);

    return NextResponse.json({
      success: data.success ?? true,
      message: `Agent responded to: "${message}"`,
      userMessage: message,
      agentResponse: assistantMessage,
      rawResponse: data,
      duration,
      timestamp: new Date().toISOString(),
      agentApiUrl,
    });
  } catch (error) {
    console.error("[DEMO] Agent API call failed:", error);
    return NextResponse.json(
      {
        error: "Failed to call agent API",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
