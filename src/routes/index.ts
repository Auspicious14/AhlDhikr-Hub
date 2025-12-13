import { Router } from "express";
import qaRouter from "./qa.routes";
import authRouter from "./auth.routes";

const router = Router();

router.use("/qa", qaRouter);
router.use("/auth", authRouter);

export default router;
