import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  list,
  create,
  remove,
  move,
} from "../controllers/content.controller.js";
const router = Router();
router.use(verifyJWT);
router.get("/", list);
router.post("/", create);
router.delete("/:id", remove);
router.patch("/:id/folder", move);
export default router;
