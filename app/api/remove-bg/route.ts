import { NextRequest, NextResponse } from "next/server";

// Remove.bg API
const REMOVE_BG_API = "https://api.remove.bg/v1.0/removebg";

export async function POST(request: NextRequest) {
  const apiKey = process.env.REMOVE_BG_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Remove.bg API key is not configured." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json(
        { error: "No image file provided." },
        { status: 400 }
      );
    }

    // 构建 Remove.bg 请求 — 图片以 FormData 形式内存传输
    const apiFormData = new FormData();
    apiFormData.append("image_file", imageFile);
    apiFormData.append("size", "auto"); // 保持原图尺寸

    const response = await fetch(REMOVE_BG_API, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { errors?: Array<{ title: string }> })?.errors?.[0]
          ?.title || `Remove.bg API error: ${response.status}`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    // 返回 PNG 二进制流（内存中传输，不落盘）
    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
      },
    });
  } catch (err) {
    console.error("Remove BG error:", err);
    return NextResponse.json(
      { error: "Failed to process image. Please try again." },
      { status: 500 }
    );
  }
}
