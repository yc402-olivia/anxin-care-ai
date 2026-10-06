import { analyzeCareAudio } from "../../server/audio";

export default analyzeCareAudio;
export const config = {
  path: "/api/analyze-audio",
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
