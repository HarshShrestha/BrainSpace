import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  list,
  save,
  view,
  remove,
} from "../controllers/received-share.controller.js";
const router = Router();
router.use(verifyJWT);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get("/", list);
router.post("/", save);
router.get("/:id", view);
router.delete("/:id", remove);
export default router;
