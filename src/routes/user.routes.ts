import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup, login, logout, me } from '../controllers/user.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many attempts. Try again later.' } });
router.post('/signup', limiter, signup); router.post('/login', limiter, login); router.post('/logout', verifyJWT, logout); router.get('/me', verifyJWT, me);
export default router;
