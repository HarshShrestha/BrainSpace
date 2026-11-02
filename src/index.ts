import "dotenv/config";
import { app } from "./app.js";
import connectDB from "./db/db.js";
const secret = process.env.ACCESS_TOKEN_SECRET;
if (!secret || secret.length < 32)
  throw new Error("ACCESS_TOKEN_SECRET must be at least 32 characters");
if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGIN)
  throw new Error("CORS_ORIGIN is required in production");
await connectDB();
app.listen(Number(process.env.PORT || 8000), () =>
  console.log(`BrainSpace API listening on port ${process.env.PORT || 8000}`),
);
