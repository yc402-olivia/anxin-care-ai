import { createCareSpeech } from "../../server/speech";

export default createCareSpeech;
export const config = {
  path: "/api/speech",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
