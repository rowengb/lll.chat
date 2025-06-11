import { type NextApiRequest, type NextApiResponse } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await convex.mutation(api.models.updateModelsWithPricing);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating models with pricing:", error);
    res.status(500).json({ error: "Failed to update models with pricing" });
  }
} 