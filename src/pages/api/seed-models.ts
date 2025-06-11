import { type NextApiRequest, type NextApiResponse } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await convex.mutation(api.models.seedModels);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error seeding models:", error);
    res.status(500).json({ error: "Failed to seed models" });
  }
} 