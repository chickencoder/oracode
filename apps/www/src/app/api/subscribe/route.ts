import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const apiKey = process.env.LOOPS_API_KEY;
    if (!apiKey) {
      console.error("LOOPS_API_KEY is not configured");
      return NextResponse.json(
        { error: "Service not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://app.loops.so/api/v1/contacts/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        subscribed: true,
        source: "Waitlist",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Loops API error:", data);

      // Handle duplicate email with a friendly message
      if (response.status === 409 || data.message?.includes("already in your audience")) {
        return NextResponse.json(
          { error: "You're already on the list!" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to subscribe" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
