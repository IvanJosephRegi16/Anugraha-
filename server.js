// server.js — Updated for Anugraha Kirloskar CRM
const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'anugraha-kirloskar-crm-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Routes
const authRoutes = require('./routes/auth');
const crmRoutes = require('./routes/crm');

app.use('/api', authRoutes);
app.use('/api/crm', crmRoutes);

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.listen(PORT, () => {
    console.log(`🚀 Anugraha Kirloskar CRM running at: http://localhost:${PORT}`);
});
