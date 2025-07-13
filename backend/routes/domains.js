const express = require('express');
const { getDatabase, closeDatabase } = require('../database/init');
const { validateDomain, verifyTransaction, isValidOctAddress } = require('../utils/validation');
const { fetchTransactionDetails } = require('../utils/octraApi');

const router = express.Router();

// Register a new domain
router.post('/register', async (req, res) => {
  const { domain, address, txHash, registeredAt } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');

  let db;

  try {
    // Validate input
    if (!domain || !address || !txHash) {
      return res.status(400).json({ 
        error: 'Missing required fields: domain, address, txHash' 
      });
    }

    // Validate domain format
    if (!validateDomain(domain)) {
      return res.status(400).json({ 
        error: 'Invalid domain format. Use format: name.oct (3-32 characters, letters/numbers/hyphens only)' 
      });
    }

    // Validate OCT address
    if (!isValidOctAddress(address)) {
      return res.status(400).json({ 
        error: 'Invalid OCT address format' 
      });
    }

    db = getDatabase();

    // Check if domain already exists
    const existingDomain = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM domains WHERE domain = ? AND status = "active"',
        [domain.toLowerCase()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingDomain) {
      return res.status(409).json({ 
        error: 'Domain already registered',
        registeredTo: existingDomain.address
      });
    }

    // Verify transaction on blockchain (optional - can be done async)
    try {
      const isValidTx = await verifyTransaction(txHash, address, domain);
      if (!isValidTx) {
        console.warn(`Transaction verification failed for ${domain}: ${txHash}`);
        // Continue anyway - verification can be done later
      }
    } catch (verifyError) {
      console.warn('Transaction verification error:', verifyError);
      // Continue anyway - verification can be done later
    }

    // Insert domain registration
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO domains (domain, address, tx_hash, registered_at) 
         VALUES (?, ?, ?, ?)`,
        [domain.toLowerCase(), address, txHash, registeredAt || Date.now()],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    // Log the registration
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO registration_logs (domain, address, tx_hash, action, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [domain.toLowerCase(), address, txHash, 'register', clientIP, userAgent],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(201).json({
      success: true,
      message: 'Domain registered successfully',
      domain: domain.toLowerCase(),
      address,
      txHash,
      id: result.id
    });

  } catch (error) {
    console.error('Domain registration error:', error);
    res.status(500).json({ 
      error: 'Failed to register domain',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (db) {
      closeDatabase(db);
    }
  }
});

// Lookup domain to get address
router.get('/lookup/:domain', async (req, res) => {
  const { domain } = req.params;
  let db;

  try {
    if (!validateDomain(domain)) {
      return res.status(400).json({ 
        error: 'Invalid domain format' 
      });
    }

    db = getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.get(
        'SELECT domain, address, registered_at FROM domains WHERE domain = ? AND status = "active"',
        [domain.toLowerCase()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!result) {
      return res.status(404).json({ 
        error: 'Domain not found' 
      });
    }

    res.json({
      domain: result.domain,
      address: result.address,
      registeredAt: result.registered_at
    });

  } catch (error) {
    console.error('Domain lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to lookup domain' 
    });
  } finally {
    if (db) {
      closeDatabase(db);
    }
  }
});

// Reverse lookup - get domain from address
router.get('/reverse/:address', async (req, res) => {
  const { address } = req.params;
  let db;

  try {
    if (!isValidOctAddress(address)) {
      return res.status(400).json({ 
        error: 'Invalid OCT address format' 
      });
    }

    db = getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.get(
        'SELECT domain, address, registered_at FROM domains WHERE address = ? AND status = "active" ORDER BY registered_at DESC LIMIT 1',
        [address],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!result) {
      return res.status(404).json({ 
        error: 'No domain found for this address' 
      });
    }

    res.json({
      domain: result.domain,
      address: result.address,
      registeredAt: result.registered_at
    });

  } catch (error) {
    console.error('Reverse lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to lookup address' 
    });
  } finally {
    if (db) {
      closeDatabase(db);
    }
  }
});

// Get all domains for an address
router.get('/address/:address/domains', async (req, res) => {
  const { address } = req.params;
  let db;

  try {
    if (!isValidOctAddress(address)) {
      return res.status(400).json({ 
        error: 'Invalid OCT address format' 
      });
    }

    db = getDatabase();

    const results = await new Promise((resolve, reject) => {
      db.all(
        'SELECT domain, address, registered_at FROM domains WHERE address = ? AND status = "active" ORDER BY registered_at DESC',
        [address],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      address,
      domains: results.map(row => ({
        domain: row.domain,
        registeredAt: row.registered_at
      })),
      count: results.length
    });

  } catch (error) {
    console.error('Address domains lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to lookup domains for address' 
    });
  } finally {
    if (db) {
      closeDatabase(db);
    }
  }
});

// Get domain statistics
router.get('/stats', async (req, res) => {
  let db;

  try {
    db = getDatabase();

    const stats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as total_domains,
          COUNT(DISTINCT address) as unique_addresses,
          MAX(registered_at) as latest_registration
         FROM domains WHERE status = "active"`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // Get recent registrations
    const recentRegistrations = await new Promise((resolve, reject) => {
      db.all(
        'SELECT domain, address, registered_at FROM domains WHERE status = "active" ORDER BY registered_at DESC LIMIT 10',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      totalDomains: stats.total_domains,
      uniqueAddresses: stats.unique_addresses,
      latestRegistration: stats.latest_registration,
      recentRegistrations: recentRegistrations.map(row => ({
        domain: row.domain,
        address: row.address,
        registeredAt: row.registered_at
      }))
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get statistics' 
    });
  } finally {
    if (db) {
      closeDatabase(db);
    }
  }
});

module.exports = router;