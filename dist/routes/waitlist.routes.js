"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const waitlist_controller_1 = require("../controllers/waitlist.controller");
const router = (0, express_1.Router)();
router.post('/waitlist', waitlist_controller_1.joinWaitlist);
exports.default = router;
