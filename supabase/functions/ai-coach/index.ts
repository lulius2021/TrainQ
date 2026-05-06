import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { getUserFromAuth } from "../_shared/supabase-admin.ts";

// Rate limiting: max requests per user per minute
const RATE_LIMIT_PER_MIN = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MIN) return false;
  entry.count++;
  return true;
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-5-haiku-20241022";
const MAX_TOKENS = 1024;

type AICoachAction =
  | "workout_recommendation"
  | "analyze_workout"
  | "generate_motivation"
  | "general_chat"
  | "chat";

interface AICoachRequest {
  action: AICoachAction;
  userContext: {
    fitnessLevel?: string;
    goals?: string[];
    recentWorkouts?: Array<{ sport: string; durationMin: number; date: string }>;
    recoveryScore?: number;
    streak?: number;
  };
  payload?: {
    workoutSummary?: string;
    question?: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    system?: string;
  };
}

function buildSystemPrompt(): string {
  return `You are TrainQ Coach, a professional AI fitness coach integrated in the TrainQ fitness app.
You provide concise, motivating, and science-based fitness advice.
Always respond in the same language the user context implies (German or English).
Keep responses short and actionable — max 3-4 sentences unless asked for more.
Never fabricate specific medical claims. Focus on motivation, technique, and training principles.`;
}

function buildUserMessage(req: AICoachRequest): string {
  const ctx = req.userContext;
  const ctxLines: string[] = [];

  if (ctx.fitnessLevel) ctxLines.push(`Fitness level: ${ctx.fitnessLevel}`);
  if (ctx.goals?.length) ctxLines.push(`Goals: ${ctx.goals.join(", ")}`);
  if (ctx.recoveryScore !== undefined) ctxLines.push(`Recovery score: ${ctx.recoveryScore}/10`);
  if (ctx.streak !== undefined) ctxLines.push(`Current streak: ${ctx.streak} days`);
  if (ctx.recentWorkouts?.length) {
    const recent = ctx.recentWorkouts
      .slice(0, 3)
      .map((w) => `${w.sport} (${w.durationMin}min on ${w.date})`)
      .join(", ");
    ctxLines.push(`Recent workouts: ${recent}`);
  }

  const contextBlock = ctxLines.length > 0 ? `User context:\n${ctxLines.join("\n")}\n\n` : "";

  switch (req.action) {
    case "workout_recommendation":
      return `${contextBlock}Based on my current state, what workout do you recommend for today? Be specific and brief.`;
    case "analyze_workout": {
      const summary = req.payload?.workoutSummary ?? "(no details provided)";
      return `${contextBlock}Please analyze this completed workout and give me feedback:\n${summary}`;
    }
    case "generate_motivation":
      return `${contextBlock}Give me a short, personalized motivational message for my next training session.`;
    case "general_chat":
      return `${contextBlock}${req.payload?.question ?? "How can I improve my training?"}`;
    default:
      return `${contextBlock}How can I improve my training?`;
  }
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await getUserFromAuth(auth);

    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: AICoachRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validActions: AICoachAction[] = [
      "workout_recommendation",
      "analyze_workout",
      "generate_motivation",
      "general_chat",
      "chat",
    ];
    if (!validActions.includes(body.action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize input
    if (body.payload?.question && body.payload.question.length > 500) {
      body.payload.question = body.payload.question.slice(0, 500);
    }
    if (body.payload?.workoutSummary && body.payload.workoutSummary.length > 1000) {
      body.payload.workoutSummary = body.payload.workoutSummary.slice(0, 1000);
    }

    const wantsStream = req.headers.get("Accept") === "text/event-stream";

    // chat action: pass full conversation messages directly
    let anthropicMessages: Array<{ role: string; content: string }>;
    let systemPrompt: string;

    if (body.action === "chat") {
      const rawMsgs = body.payload?.messages ?? [];
      if (!rawMsgs.length) {
        return new Response(JSON.stringify({ error: "messages array required for chat action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Sanitize each message content
      anthropicMessages = rawMsgs.slice(-20).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "").slice(0, 1000),
      }));
      systemPrompt = body.payload?.system ? String(body.payload.system).slice(0, 2000) : buildSystemPrompt();
    } else {
      const userMessage = buildUserMessage(body);
      anthropicMessages = [{ role: "user", content: userMessage }];
      systemPrompt = buildSystemPrompt();
    }

    const anthropicPayload = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      stream: wantsStream,
      messages: anthropicMessages,
    };

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicPayload),
    });

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", anthropicRes.status);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wantsStream && anthropicRes.body) {
      return new Response(anthropicRes.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    const data = await anthropicRes.json();
    const text = data?.content?.[0]?.text ?? "";

    return new Response(JSON.stringify({ text, action: body.action }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-coach error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const safeMsg = msg.includes("Unauthorized") ? "Unauthorized" : "Internal server error";
    return new Response(JSON.stringify({ error: safeMsg }), {
      status: e instanceof Error && e.message === "Unauthorized" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
