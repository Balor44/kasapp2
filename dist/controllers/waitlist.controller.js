"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinWaitlist = void 0;
const Waitlist_1 = require("../models/Waitlist");
const joinWaitlist = async (req, res) => {
    try {
        const { phone } = req.body;
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
