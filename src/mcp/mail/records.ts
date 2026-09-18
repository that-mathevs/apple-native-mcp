import { z } from "zod";

export const mailAccountRecord = z.object({
  identifier: z.string(),
  name: z.string(),
  emailAddresses: z.array(z.string()),
});
