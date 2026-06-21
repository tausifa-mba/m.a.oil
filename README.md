# MSME Container Trading Inventory & ERP System

A complete full-stack Business ERP system designed for small MSME container trading businesses operating across multiple plants/warehouses. Built using React (Vite + Ant Design) and Node.js (Express + Mongoose + MongoDB).

---

## 🏗️ Folder Structure

```
/Users/mohammedinzammulhaque/Desktop/taushif
├── backend/
│   ├── config/             # Database connectivity (db.js)
│   ├── controllers/        # Express controllers (auth, inventory, sales, etc.)
│   ├── middlewares/        # Middlewares (JWT auth, express-rate-limit, Joi validate)
│   ├── models/             # Mongoose Schemas (15 Collections)
│   ├── repositories/       # Data Access Layer (BaseRepository and specific extends)
│   ├── routes/             # Express Route mappings
│   ├── services/           # Business Logic Layer (ACID Stock-Transfers & Invoicing)
│   ├── utils/              # PDF Invoice templates (pdfkit) & Barcodes (bwip-js)
│   ├── .env                # Port, Database URIs, JWT Secrets
│   ├── package.json        # Dependencies config
│   ├── seed.js             # 12-Module database seeder script
│   ├── server.js           # Express main app entry point
│   └── test-transactions.js# ACID Mongoose Session unit test checks
└── frontend/
    ├── src/
    │   ├── components/     # AppLayout core responsive sidebar shell
    │   ├── context/        # React AuthContext session provider
    │   ├── pages/          # Dashboard, CRUD forms, and ledger screens
    │   ├── services/       # Axios API client setup (api.js)
    │   ├── App.jsx         # Router switches and route guards
    │   ├── index.css       # Corporate royal blue custom styles
    │   └── main.jsx        # Bootloader and ConfigProvider tokens
    ├── .env                # API target paths
    ├── index.html          # HTML entry
    ├── package.json        # Frontend client modules config
    └── vite.config.js      # Bundler configurations and reverse proxy redirects
```

---

## ⚙️ Prerequisites & Setup Guide

### 1. MongoDB Replica Set Setup (CRITICAL)
Invoices, Purchases, and Stock Transfers use **MongoDB Transactions** (Mongoose Sessions) to guarantee absolute ACID data consistency. MongoDB transactions require the database to run in a replica set environment. 

To easily convert a local standalone MongoDB instance into a single-node replica set:
1. Start your Mongo daemon specifying a replica set name (e.g., `rs0`):
   ```bash
   mongod --replSet rs0 --dbpath /path/to/data/db
   ```
2. Open a new terminal window, connect to the database via Mongo shell (`mongosh`), and initiate the set:
   ```javascript
   rs.initiate()
   ```

---

### 2. Backend Installation & Seeding
1. Open a terminal in the `/backend` folder:
   ```bash
   cd backend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the database seeder to populate mock plants, containers, clients, employees, expenses, and log sheets:
   ```bash
   npm run seed
   ```
4. Run transaction integration checks to confirm database rollbacks work:
   ```bash
   npm run test-tx
   ```
5. Launch the Node.js API server:
   ```bash
   npm run dev
   ```
   *The server starts listening on http://localhost:5001.*

---

### 3. Frontend Installation & Run
1. Open a terminal in the `/frontend` folder:
   ```bash
   cd ../frontend
   ```
2. Install client-side npm dependencies:
   ```bash
   npm install
   ```
3. Boot the local development server:
   ```bash
   npm run dev
   ```
   *The client server launches on http://localhost:3000.*

---

## 🔑 Login Credentials

The seeder initializes three roles to test authorization filters:

* **Admin Access**:
  * Email: `admin@containererp.com`
  * Password: `Admin@123`
  * *Privileges: Full access (Settings, Employee CRUD, Reports downloads, Stock overrides, Ledger Statements).*

* **Manager Access**:
  * Email: `manager@containererp.com`
  * Password: `Manager@123`
  * *Privileges: Operational controls (Record purchases, execute transfers, mark attendance, generate payroll, view metrics).*

* **Staff Access**:
  * Email: `staff@containererp.com`
  * Password: `Staff@123`
  * *Privileges: Transaction processing only (Create invoices, select products, view stock levels. Redirected automatically to products view; Dashboard and Reports disabled).*

---

## 🛡️ Security Integrations
* **JWT Bearer Authentication**: Decodes roles and locks routes dynamically in both Express endpoints and React routers.
* **Password Hashing**: Salts and hashes passwords automatically on Mongoose pre-save triggers using `bcryptjs`.
* **Input Validation**: Joi validates schemas in route pipelines before letting data hit database collections.
* **HTTP Hardening**: Helmet sets secure headers. CORS limits cross-origin access.
* **Brute-Force Protection**: Express-rate-limit caps requests per IP (tighter limits on authentication paths).
