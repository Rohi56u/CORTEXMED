import { NextRequest, NextResponse } from "next/server";
import { CORTEXMED_MCP_TOOLS, executeMcpTool } from "@/lib/tools/mcp-health";

export async function GET() {
  return NextResponse.json({
    ok: true,
    server: "CortexMed MCP Clinical Engine",
    version: "1.0.0",
    tools: CORTEXMED_MCP_TOOLS,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, args } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required parameter 'name' (string)",
          code: "INVALID_REQUEST",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const toolArgs = (args && typeof args === "object" ? args : {}) as Record<string, unknown>;
    const result = await executeMcpTool(name, toolArgs);

    let status = 200;
    if (!result.ok) {
      if (result.code === "VALIDATION_ERROR" || result.code === "UNKNOWN_TOOL") {
        status = 400;
      } else if (result.code === "DATABASE_UNCONFIGURED") {
        status = 503;
      } else {
        status = 500;
      }
    }

    return NextResponse.json(result, { status });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Invalid JSON or MCP request payload",
        code: "PARSE_ERROR",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }
}
