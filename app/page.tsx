import { CareCompanion } from "./CareCompanion";
import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return (
    <CareCompanion
      viewerName={user.fullName || user.email}
      signOutHref={chatGPTSignOutPath("/")}
    />
  );
}
