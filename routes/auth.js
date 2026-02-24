// routes/auth.js — Full Auth & OTP Logic for CRM
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

// ─── SIGNUP ───
router.post('/signup', async (req, res) => {
    try {
        const { fullname, phone, email, password } = req.body;
        if (!fullname || !phone || !password) return res.json({ success: false, message: 'Missing fields.' });
        if (db.prepare('SELECT count(*) as count FROM users WHERE phone = ?').get(phone.trim()).count > 0)
            return res.json({ success: false, message: 'Phone already registered.' });

        const passwordHash = await bcrypt.hash(password, 10);
        const role = db.prepare('SELECT count(*) as count FROM users').get().count === 0 ? 'Admin' : 'Staff';

        db.prepare('INSERT INTO users (fullname, phone, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(fullname.trim(), phone.trim(), email || null, passwordHash, role);
        return res.json({ success: true });
    } catch (err) { return res.json({ success: false, message: 'Signup failed.' }); }
});

// ─── LOGIN ───
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = db.prepare(`SELECT * FROM users WHERE phone = ? OR email = ?`).get(identifier.trim(), identifier.trim());
        if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.json({ success: false, message: 'Invalid credentials.' });

        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.name = user.fullname;
        return res.json({ success: true });
    } catch (err) { return res.json({ success: false, message: 'Login error.' }); }
});

router.get('/logout', (req, res) => { req.session.destroy(() => res.json({ success: true })); });
router.get('/me', (req, res) => { res.json(req.session.userId ? { loggedIn: true, name: req.session.name, role: req.session.userRole } : { loggedIn: false }); });

// ─── FORGOT PASSWORD ───
router.post('/forgot-password', async (req, res) => {
    try {
        const { phone } = req.body;
        const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone.trim());
        if (!user) return res.json({ success: false, message: 'Phone number not registered.' });

        const otp = generateOTP();
        const expires = Date.now() + 10 * 60 * 1000; // 10 mins
        db.prepare('UPDATE users SET otp = ?, otp_expires_at = ? WHERE id = ?').run(otp, expires, user.id);

        console.log(`🔑 [OTP] Password reset for ${phone}: ${otp}`);
        return res.json({ success: true, otp }); // OTP returned for dev ease
    } catch (err) { return res.json({ success: false, message: 'Server error.' }); }
});

// ─── VERIFY OTP & RESET ───
router.post('/verify-otp', async (req, res) => {
    try {
        const { phone, otp, newPassword } = req.body;
        const user = db.prepare('SELECT id, otp, otp_expires_at FROM users WHERE phone = ?').get(phone.trim());

        if (!user || user.otp !== otp || Date.now() > user.otp_expires_at)
            return res.json({ success: false, message: 'Invalid or expired OTP.' });

        const hash = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ?, otp = NULL, otp_expires_at = NULL WHERE id = ?').run(hash, user.id);
        return res.json({ success: true });
    } catch (err) { return res.json({ success: false, message: 'Reset failed.' }); }
});

module.exports = router;
