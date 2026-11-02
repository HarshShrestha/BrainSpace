import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { create, revoke, view } from '../controllers/share.controller.js';
const router = Router(); router.get('/:token', view); router.post('/', verifyJWT, create); router.delete('/', verifyJWT, revoke); export default router;
