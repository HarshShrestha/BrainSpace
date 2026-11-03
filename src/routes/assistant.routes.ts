import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getStatus,
  index,
  ask,
  removeIndex,
} from "../controllers/assistant.controller.js";
const router = Router();
router.use(verifyJWT);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.userId!,
  message: {
    success: false,
    message: "Too many AI requests. Try again later.",
  },
});
router.get("/status", getStatus);
router.post("/index/:id", limiter, index);
router.delete("/index/:id", removeIndex);
router.post("/ask", limiter, ask);
export default router;
