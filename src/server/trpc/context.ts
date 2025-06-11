import { type NextApiRequest, type NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";

export const createTRPCContext = async (opts: {
  req: NextApiRequest;
  res: NextApiResponse;
}) => {
  const { req, res } = opts;
  const auth = getAuth(req);

  return {
    req,
    res,
    auth,
    userId: auth.userId,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>; 