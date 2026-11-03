import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { list, create, remove } from "../controllers/folder.controller.js";
const router = Router();
router.use(verifyJWT);
router.get("/", list);
router.post("/", create);
router.delete("/:id", remove);
export default router;
