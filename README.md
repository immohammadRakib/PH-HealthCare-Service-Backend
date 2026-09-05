# ⚡ Smart Power Grid & Outage Management SaaS Backend

A highly scalable, multi-tenant B2B/B2C SaaS backend architecture engineered using **Node.js, TypeScript, Express.js, and PostgreSQL with Prisma ORM**. This platform streamlines grid infrastructure mapping, handles real-time emergency outage resolution, automates field-technician dispatch constraints, and implements a secure smart prepaid meter recharge system utilizing transactional database operations.

---

## 🏗️ Grid Infrastructure Hierarchy & Data Flow

The database layer strictly enforces a relational parental chain to ensure structural integrity across the entire electricity distribution grid.

```text
[Power Authority] (e.g., DESCO, DPDC HQ)
       │
       ▼
[Distribution Zone] ◄─── Managed by [ZONE_MANAGER] (Monitors localized technician teams)
       │
       ▼
[Substation] ◄────────── Monitored by [POWER_OPERATOR] (Executes grid level line isolation)
       │
       ▼
[Feeder Line] (High-voltage distribution distribution cable)
       │
       ▼
   [Area] (The target localized grid endpoint)
     ├──► [Scheduled Outage] (Planned) ──► [Automated Email Notification Blasts to Customers]
     └──► [Unexpected Outage] (Manual) ──► [Emergency Ticket] ──► [Auto-Assigned Free Technician]
```

---

## 🔒 Security & Role-Based Access Control (RBAC)

The backend features a zero-trust architecture protected by a centralized **JWT Verification Layer** and strict **Role-Based Middlewares** supporting 6 dynamic operational profiles:

1. **`SUPER_ADMIN`**: Global data controller, analytics visualizer, and infrastructure auditor.
2. **`ADMIN`**: Technical manager in charge of listing new power authorities, substations, and zones.
3. **`ZONE_MANAGER`**: Regional chief capable of manually assigning tickets and monitoring field workers.
4. **`POWER_OPERATOR`**: Substation control room engineer who implements scheduled load-shedding blocks.
5. **`TECHNICIAN`**: On-field technical workforce assigned to physical repair workflows.
6. **`CUSTOMER`**: Local residential/commercial power consumers tracking balance and active line statuses.
---

## 🎯 End-to-End API Execution Guide (Postman Walkthrough)

Execute the following sequential API flow to simulate a complete real-world user lifecycle, payment gateway synchronization, and automated incident management loop.

### 🔐 Phase 1: Authentication & Dynamic Profiling

#### Step 1: Customer Account Creation
Registers a basic user object. The database hooks initialize a clean, isolated Customer row with empty relational references to ensure friction-free signup (Google Sign-In compliant).
* **HTTP Method:** `POST`
* **Route:** `/api/v1/auth/register`
* **Request Body:**
  ```json
  {
    "name": "Rakib Customer",
    "email": "rakib@customer.com",
    "password": "Password123@",
    "role": "CUSTOMER"
  }
  ```

#### Step 2: Secure OTP Account Activation
Validates the signup integrity using Redis-backed secure OTP matching, updates account status to `ACTIVE`, and signs the authorization JSON Web Token.
* **HTTP Method:** `POST`
* **Route:** `/api/v1/auth/verify-otp`
* **Request Body:**
  ```json
  {
    "email": "rakib@customer.com",
    "otp": "YOUR_6_DIGIT_TERMINAL_LOGGED_OTP"
  }
  ```
* **Response:** Extracts an `accessToken` (Inject this token inside Postman's `Bearer Token` Authorization header for the upcoming phases).

#### Step 3: Link Infrastructure Node (Dashboard Onboarding)
Once logged in, the customer links their real-world household parameters—specifically their unique digital meter number and target grid location (`areaId`).
* **HTTP Method:** `PATCH`
* **Route:** `/api/v1/customers/update-profile`
* **Request Body:**
  ```json
  {
    "accountNumber": "ACC-998877",
    "meterNumber": "MTR-112233",
    "billingAddress": "Zindabazar, Sylhet",
    "areaId": "YOUR_VALID_AREA_UUID_FROM_DATABASE"
  }
  ```
---

### 💳 Phase 2: Mandatory Payment & Balance Synchronization

#### Step 4: Initiate Smart Meter Recharge
Triggers the payment initialization workflow. Registers a locked row in the ledger with a status of `PENDING`.
* **HTTP Method:** `POST`
* **Route:** `/api/v1/payments/initiate`
* **Request Body:**
  ```json
  {
    "amount": 500,
    "provider": "BKASH"
  }
  ```
* **Response:** Generates an isolated tracking token `transactionId` (e.g., `TXN-172551...`).

#### Step 5: Gateway Status Callback (Webhook Endpoint)
Simulates a real-world secure webhook confirmation from payment providers (bKash/Stripe). Executes an atomic Prisma database transaction block (`$transaction`) to lock resources, prevent balance race-conditions, increments the consumer balance, updates payment status to `SUCCESS`, and signs an immutable audit trail entry inside `AuditLog`.
* **HTTP Method:** `POST`
* **Route:** `/api/v1/payments/webhook`
* **Request Body:**
  ```json
  {
    "transactionId": "YOUR_GENERATED_TXN_ID",
    "status": "SUCCESS"
  }
  ```
* **Validation:** Re-run a `GET` request to `/api/v1/users/me` to witness the live smart meter account balance incremented to `500.00 BDT`.

---

### 🚨 Phase 3: Unexpected Breakdown & Intelligent Dispatch Loop

#### Step 6: Customer Emergency Complaint Ticket
Fired manually by a consumer when localized physical damage or unexpected line anomalies happen. 
* **HTTP Method:** `POST`
* **Route:** `/api/v1/outages/report`
* **Request Body:**
  ```json
  {
    "description": "The street transformer burst with a loud sound near Chitrali Shoes!"
  }
  ```
* **SaaS Automation Layer:** The algorithm resolves the area's parent node (`Area -> Feeder -> Substation -> Zone`). It immediately queries the database for workers under that Zone who have a status of `AVAILABLE`. It binds the allocation, toggles the ticket to `ASSIGNED`, and locks the technician's profile status to `ON_DUTY` so they are excluded from other dispatches.

#### Step 7: Conditional Field Clearance (Restoration Engine)
Executed by the worker once physical maintenance is concluded. If the worker passes `FAILED` (due to inadequate tools or severe grid breakdown), the ticket gracefully slips back into the pending queue. If passed `RESOLVED`, the transaction unlocks the worker back to `AVAILABLE` and stamps the entire grid sector back to active.
* **HTTP Method:** `PATCH`
* **Route:** `/api/v1/outages/resolve/:reportId`
* **Request Body:**
  ```json
  {
    "action": "RESOLVED",
    "proofImage": "https://cloudinary.com"
  }
  ```
* **Response:** `200 OK` -> `⚡ Power supply restored, technician released, and job logged successfully.`
