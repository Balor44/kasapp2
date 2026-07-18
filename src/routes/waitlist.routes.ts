import { Router } from 'express';
import { joinWaitlist } from '../controllers/waitlist.controller';

const router = Router();
router.post('/waitlist', joinWaitlist);
export default router;