# OCT Domain Backend Server

Backend server untuk sistem registrasi domain OCT yang terintegrasi dengan blockchain Octra.

## 🚀 Features

- **Domain Registration**: Registrasi domain .oct dengan verifikasi blockchain
- **Domain Lookup**: Pencarian domain ke address dan sebaliknya
- **Transaction Verification**: Verifikasi transaksi registrasi di blockchain
- **Rate Limiting**: Perlindungan dari spam dan abuse
- **Audit Logging**: Log semua aktivitas registrasi
- **SQLite Database**: Database ringan dan mudah deploy

## 📋 Prerequisites

- Node.js 16+ 
- npm atau yarn
- SQLite3

## 🛠️ Installation

1. **Clone dan setup:**
```bash
cd backend
npm install
```

2. **Setup environment:**
```bash
cp .env.example .env
# Edit .env sesuai konfigurasi Anda
```

3. **Initialize database:**
```bash
npm run init-db
```

4. **Start server:**
```bash
# Development
npm run dev

# Production
npm start
```

## ⚙️ Configuration

Edit file `.env`:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database
DB_PATH=./database/domains.db

# OCT Network Configuration
OCTRA_RPC_URL=https://octra.network
MASTER_WALLET_ADDRESS=oct1234567890abcdef1234567890abcdef12345678

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=https://yourfrontend.com,https://wallet.octra.network
```

## 🔌 API Endpoints

### Domain Registration
```http
POST /api/domain/register
Content-Type: application/json

{
  "domain": "myname.oct",
  "address": "oct1234...",
  "txHash": "abc123...",
  "registeredAt": 1234567890
}
```

### Domain Lookup
```http
GET /api/domain/lookup/myname.oct

Response:
{
  "domain": "myname.oct",
  "address": "oct1234...",
  "registeredAt": 1234567890
}
```

### Reverse Lookup
```http
GET /api/domain/reverse/oct1234...

Response:
{
  "domain": "myname.oct", 
  "address": "oct1234...",
  "registeredAt": 1234567890
}
```

### Address Domains
```http
GET /api/domain/address/oct1234.../domains

Response:
{
  "address": "oct1234...",
  "domains": [
    {
      "domain": "myname.oct",
      "registeredAt": 1234567890
    }
  ],
  "count": 1
}
```

### Statistics
```http
GET /api/domain/stats

Response:
{
  "totalDomains": 1234,
  "uniqueAddresses": 567,
  "latestRegistration": 1234567890,
  "recentRegistrations": [...]
}
```

### Health Check
```http
GET /health

Response:
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## 🔒 Security Features

- **Rate Limiting**: Maksimal 100 request per 15 menit per IP
- **CORS Protection**: Hanya domain yang diizinkan
- **Input Validation**: Validasi ketat untuk semua input
- **SQL Injection Protection**: Menggunakan prepared statements
- **Transaction Verification**: Verifikasi transaksi di blockchain
- **Audit Logging**: Log semua aktivitas dengan IP dan User-Agent

## 📊 Database Schema

### domains table
```sql
CREATE TABLE domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  registered_at INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active'
);
```

### registration_logs table
```sql
CREATE TABLE registration_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Deployment

### Using PM2 (Recommended)
```bash
npm install -g pm2
pm2 start server.js --name "oct-domain-backend"
pm2 startup
pm2 save
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Using systemd
```ini
[Unit]
Description=OCT Domain Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 🔧 Maintenance

### Backup Database
```bash
cp ./database/domains.db ./backups/domains-$(date +%Y%m%d).db
```

### View Logs
```bash
# PM2 logs
pm2 logs oct-domain-backend

# Direct logs
tail -f logs/app.log
```

### Database Queries
```bash
sqlite3 ./database/domains.db

# View all domains
SELECT * FROM domains ORDER BY registered_at DESC;

# View statistics
SELECT COUNT(*) as total, COUNT(DISTINCT address) as unique_addresses FROM domains;
```

## 🐛 Troubleshooting

### Common Issues

1. **Database locked error**
   - Pastikan tidak ada proses lain yang menggunakan database
   - Restart server jika perlu

2. **CORS errors**
   - Periksa konfigurasi ALLOWED_ORIGINS di .env
   - Pastikan frontend URL sudah benar

3. **Transaction verification failed**
   - Periksa MASTER_WALLET_ADDRESS di .env
   - Pastikan OCTRA_RPC_URL dapat diakses

4. **Rate limit exceeded**
   - Sesuaikan RATE_LIMIT_MAX_REQUESTS jika perlu
   - Implementasi whitelist untuk IP tertentu

## 📝 License

MIT License - lihat file LICENSE untuk detail.