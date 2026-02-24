// routes/crm.js — Full CRM logic for Anugraha Kirloskar
const express = require('express');
const router = express.Router();
const db = require('../database');

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ success: false, message: 'Unauthorized' });
}

router.use(isAuthenticated);

// ─── DASHBOARD STATS ────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const totalCustomers = db.prepare("SELECT count(*) as count FROM customers").get().count;
    const totalConverted = db.prepare("SELECT count(*) as count FROM calls WHERE status = 'Converted'").get().count;
    const totalNotConverted = db.prepare("SELECT count(*) as count FROM calls WHERE status = 'Not Converted'").get().count;

    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);
    const todayCalls = db.prepare("SELECT count(*) as count FROM calls WHERE call_date = ?").get(today).count;
    const monthCalls = db.prepare("SELECT count(*) as count FROM calls WHERE call_date LIKE ?").get(month + '%').count;

    res.json({
      success: true,
      kpis: {
        totalCustomers,
        totalConverted,
        totalNotConverted,
        todayCalls,
        monthCalls,
        conversionRate: totalCustomers > 0 ? ((totalConverted / totalCustomers) * 100).toFixed(1) : 0
      },
      charts: {
        soilDistribution: db.prepare("SELECT soil_type as label, count(*) as count FROM calls WHERE soil_type IS NOT NULL AND soil_type != '' GROUP BY soil_type").all(),
        productDistribution: db.prepare("SELECT product as label, count(*) as count FROM calls WHERE product IS NOT NULL AND product != '' GROUP BY product").all(),
        sourceDistribution: db.prepare("SELECT source as label, count(*) as count FROM calls WHERE source IS NOT NULL AND source != '' GROUP BY source").all(),
        monthlyTrends: db.prepare(`
          SELECT strftime('%Y-%m', call_date) as month, count(*) as count 
          FROM calls 
          WHERE call_date >= date('now', '-5 months', 'start of month') 
          GROUP BY month 
          ORDER BY month
        `).all()
      },
      todayFollowUps: db.prepare(`
        SELECT c.name, c.phone, ca.status, ca.id as call_id
        FROM customers c
        JOIN calls ca ON c.id = ca.customer_id
        WHERE ca.follow_up_date = date('now')
        AND ca.id = (SELECT MAX(id) FROM calls WHERE customer_id = c.id)
      `).all(),
      overdueCount: db.prepare(`
        SELECT count(*) as count 
        FROM calls 
        WHERE follow_up_date < date('now') 
        AND follow_up_date IS NOT NULL 
        AND status != 'Converted'
      `).get().count
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ─── CUSTOMER MANAGEMENT ─────────────────────────────────────────────────────

// List Customers with Advanced Filtering & Search
router.get('/customers', (req, res) => {
  try {
    const { search, status, source, product, district, start_date, end_date } = req.query;

    let sql = `
       SELECT c.*, ca.id as call_id, ca.call_date, ca.status, ca.source, ca.product, ca.outcome, ca.follow_up_date 
       FROM customers c
       JOIN calls ca ON c.id = ca.customer_id
       WHERE ca.id = (SELECT MAX(id) FROM calls WHERE customer_id = c.id)
    `;
    const params = [];

    if (search) {
      sql += ` AND (c.name LIKE ? OR c.phone LIKE ?) `;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      sql += ` AND ca.status = ? `;
      params.push(status);
    }
    if (source) {
      sql += ` AND ca.source = ? `;
      params.push(source);
    }
    if (product) {
      sql += ` AND ca.product = ? `;
      params.push(product);
    }
    if (district) {
      sql += ` AND c.district = ? `;
      params.push(district);
    }
    if (start_date && end_date) {
      sql += ` AND ca.call_date BETWEEN ? AND ? `;
      params.push(start_date, end_date);
    }

    sql += ` ORDER BY ca.call_date DESC, ca.id DESC `;

    const customers = db.prepare(sql).all(...params);
    res.json({ success: true, customers });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Check duplicate phone
router.get('/customers/check/:phone', (req, res) => {
  const customer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(req.params.phone);
  res.json({ exists: !!customer, customer });
});

// Create Customer + Call
router.post('/customers', (req, res) => {
  try {
    const { name, phone, district, call_date, status, source, product, soil_type, outcome, follow_up_date, notes } = req.body;

    let customerId;
    const existing = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone.trim());

    if (existing) {
      customerId = existing.id;
      db.prepare("UPDATE customers SET name = ?, district = ? WHERE id = ?").run(name, district, customerId);
    } else {
      const result = db.prepare("INSERT INTO customers (name, phone, district) VALUES (?, ?, ?)")
        .run(name, phone.trim(), district);
      customerId = result.lastInsertRowid;
    }

    db.prepare(`
      INSERT INTO calls (customer_id, call_date, status, source, product, soil_type, outcome, follow_up_date, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customerId, call_date, status, source, product, soil_type, outcome, follow_up_date || null, notes, req.session.userId);

    res.json({ success: true, message: 'Record saved!' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Delete Customer and history
router.delete('/customers/:id', (req, res) => {
  try {
    db.prepare("DELETE FROM calls WHERE customer_id = ?").run(req.params.id);
    db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ─── CUSTOMER EDIT ───────────────────────────────────────────────────────

// Get single call record details
router.get('/calls/:id', (req, res) => {
  try {
    const call = db.prepare(`
      SELECT c.id as customer_id, c.name, c.phone, c.district, 
             ca.id as call_id, ca.call_date, ca.status, ca.source, ca.product, ca.soil_type, ca.outcome, ca.follow_up_date, ca.notes
      FROM calls ca
      JOIN customers c ON ca.customer_id = c.id
      WHERE ca.id = ?
    `).get(req.params.id);
    if (!call) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, call });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Update single call record
router.put('/calls/:id', (req, res) => {
  try {
    const { call_date, status, source, product, soil_type, outcome, follow_up_date, notes } = req.body;
    db.prepare(`
      UPDATE calls 
      SET call_date = ?, status = ?, source = ?, product = ?, soil_type = ?, outcome = ?, follow_up_date = ?, notes = ?
      WHERE id = ?
    `).run(call_date, status, source, product, soil_type, outcome, follow_up_date || null, notes, req.params.id);
    res.json({ success: true, message: 'Record updated!' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Update customer static info
router.put('/customers/:id', (req, res) => {
  try {
    const { name, district } = req.body;
    db.prepare("UPDATE customers SET name = ?, district = ? WHERE id = ?")
      .run(name, district, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ─── FOLLOW-UPS ──────────────────────────────────────────────────────────────
router.get('/followups', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const overdue = db.prepare(`
            SELECT c.name, c.phone, ca.* 
            FROM calls ca
            JOIN customers c ON ca.customer_id = c.id
            WHERE ca.follow_up_date < ? AND ca.follow_up_date IS NOT NULL AND ca.status != 'Converted'
            ORDER BY ca.follow_up_date ASC
        `).all(today);

    const activeToday = db.prepare(`
            SELECT c.name, c.phone, ca.* 
            FROM calls ca
            JOIN customers c ON ca.customer_id = c.id
            WHERE ca.follow_up_date = ?
            ORDER BY ca.id DESC
        `).all(today);

    const upcoming = db.prepare(`
            SELECT c.name, c.phone, ca.* 
            FROM calls ca
            JOIN customers c ON ca.customer_id = c.id
            WHERE ca.follow_up_date > ?
            ORDER BY ca.follow_up_date ASC
        `).all(today);

    res.json({ success: true, overdue, today: activeToday, upcoming });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/calls/:id/status', (req, res) => {
  try {
    db.prepare("UPDATE calls SET status = ? WHERE id = ?").run(req.body.status, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ─── REPORTS API ─────────────────────────────────────────────────────────────
router.get('/reports/data', (req, res) => {
  try {
    const monthlyData = db.prepare(`
            SELECT strftime('%Y-%m', call_date) as month,
                   COUNT(CASE WHEN status = 'Lead' THEN 1 END) as leads,
                   COUNT(CASE WHEN status = 'Converted' THEN 1 END) as converted
            FROM calls
            GROUP BY month
            ORDER BY month DESC LIMIT 6
        `).all().reverse();

    const productStats = db.prepare(`
            SELECT product, COUNT(*) as count 
            FROM calls 
            WHERE product IS NOT NULL AND product != ''
            GROUP BY product 
            ORDER BY count DESC
        `).all();

    const sourceStats = db.prepare(`
            SELECT source, COUNT(*) as count 
            FROM calls 
            WHERE source IS NOT NULL AND source != ''
            GROUP BY source 
            ORDER BY count DESC
        `).all();

    const districtStats = db.prepare(`
            SELECT c.district, COUNT(*) as count 
            FROM customers c
            JOIN calls ca ON c.id = ca.customer_id
            WHERE c.district IS NOT NULL AND c.district != ''
            GROUP BY c.district
            ORDER BY count DESC
        `).all();

    res.json({ success: true, monthlyData, productStats, sourceStats, districtStats });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────
router.get('/settings', (req, res) => {
  const products = db.prepare("SELECT id, value FROM settings WHERE category = 'product'").all();
  const sources = db.prepare("SELECT id, value FROM settings WHERE category = 'source'").all();
  const districts = db.prepare("SELECT id, value FROM settings WHERE category = 'district'").all();
  res.json({ success: true, products, sources, districts });
});

router.post('/settings', (req, res) => {
  try {
    const { category, value } = req.body;
    db.prepare("INSERT INTO settings (category, value) VALUES (?, ?)").run(category, value);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.delete('/settings/:id', (req, res) => {
  try {
    db.prepare("DELETE FROM settings WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
