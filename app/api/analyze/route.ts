import { analyzeCareDocuments } from "../../../server/analyze";
import { getChatGPTUser } from "../../chatgpt-auth";

export const runtime = "edge";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json(
      { error: { code: "AUTH_REQUIRED", message: "Please sign in to use AI document analysis." } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return analyzeCareDocuments(request);
}
