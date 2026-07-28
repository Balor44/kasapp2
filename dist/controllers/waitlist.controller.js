"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinWaitlist = void 0;
const Waitlist_1 = require("../models/Waitlist");
const phone_1 = require("../utils/phone");
const joinWaitlist = async (req, res) => {
    try {
        const { phone: rawPhone } = req.body;
        const phone = (0, phone_1.normalizePhone)(rawPhone);
        if (!phone) {
            res.status(400).json({ error: 'Phone number is required' });
            return;
        }
        const existing = await Waitlist_1.WaitlistModel.findOne({ phone });
        if (existing) {
            res.status(409).json({ error: 'Already on the waitlist', number: existing.number });
            return;
        }
        const count = await Waitlist_1.WaitlistModel.countDocuments();
        const number = count + 1;
        await Waitlist_1.WaitlistModel.create({ phone, number });
        res.status(201).json({ message: 'You are on the waitlist!', number, phone });
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
exports.joinWaitlist = joinWaitlist;
