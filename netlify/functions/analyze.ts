import { analyzeCareDocuments } from "../../server/analyze";

export default analyzeCareDocuments;
export const config = {
  path: "/api/analyze",
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
