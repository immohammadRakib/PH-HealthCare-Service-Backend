# Project Requirements — Smart Load Shedding & Power Outage Management System

## 1. Overview

The Smart Load Shedding & Power Outage Management System is an enterprise-grade utility automation platform built to orchestrate electricity distribution, track real-time power grid states, and manage infrastructure maintenance. The platform models a multi-tier national grid hierarchy (`Power Authority → Distribution Zone → Substation → Feeder → Area`) to balance supply deficits through automated, priority-based scheduling. Additionally, it provides real-time consumer anomaly diagnostic reporting and automated field technician dispatching for unexpected line faults (blackouts). 

Admins and operational personnel keep the grid functioning smoothly: they manage the infrastructure nodes, execute manual emergency dispatches, and generate energy allocation schedules so that customers, field technicians, and substation operators interact seamlessly without manual operational friction.

This document is the official product specification detailing exactly what the system must do and the precise business rules it must follow. It is not the database schema and not the API design; those come next, and every rule below is written so that whoever designs them doesn't have to guess.

---

## 2. User Roles

Five distinct roles orchestrate the platform: **Super Admin**, **Admin**, **Zone Manager**, **Power Operator**, and **Customer** (with an implicitly mapped **Technician** entity for maintenance).

| Role | Onboarding Mechanism | Primary Authentication Channel |
| :--- | :--- | :--- |
| **Customer** | Registers directly — email/password credentials or Google OAuth. | Email/password or Google OAuth. |
| **Technician** | Onboarded exclusively by an Admin or Zone Manager — cannot self-register. | Email/password only. |
| **Power Operator**| Created/Onboarded exclusively by an Admin or Super Admin — cannot self-register. | Email/password only. |
| **Zone Manager** | Created/Onboarded exclusively by a Super Admin — cannot self-register. | Email/password only. |
| **Admin** | Created by a Super Admin or an existing Admin — cannot self-register. | Email/password only. |
| **Super Admin** | Created exclusively by another Super Admin — cannot self-register. | Email/password only. |

Google login is a **customer-only** feature. All administrative, operational, and field technical personnel always use email and password credentials.

### 2.1 Who Can Manage Whom

Admin and Super Admin have the same day-to-day powers — managing infrastructure, auditing substation logs, blocking problematic accounts — with structural exceptions reserved exclusively for the Super Admin:

| Action | Admin | Super Admin |
| :--- | :---: | :---: |
| Onboard or offboard a Field Technician | ✅ | ✅ |
| Assign or change a Power Operator's designated Substation | ✅ | ✅ |
| Block or unblock a Customer Account | ✅ | ✅ |
| Create a new Admin Account | ✅ | ✅ |
| Create or promote a user to a Super Admin | ❌ | ✅ |
| Block or unblock a structural Admin | ❌ | ✅ |
| Block, unblock, or delete a fellow Super Admin | ❌ | ✅ |

In short: An Admin can act on grid operational roles (Operators, Technicians) and consumers freely, but only a Super Admin can act on another Admin or Super Admin account.

These operational interfaces live behind four clean management modules: **Grid Infrastructure Management**, **Maintenance Crew Dispatch**, **Consumer Wallet Operations**, and **Administrative Ledger Audit**.

---

## 3. Accounts and Authentication

### 3.1 Registration

- **Customer** registers with a name, email, and password — or with Google OAuth. Either way, they land in the system as a Customer; there is no way to register directly as an administrator or grid employee.
- **Field Technicians and Operators** are introduced to the platform via back-office employee flows. They do not appear as valid system actors until an authorized manager instantiates their sub-profiles and binds them to a specific structural node (Zone or Substation).
- **Admin and Super Admin** accounts are strictly provisioned by existing authorities through the internal administrative creation dashboard.

### 3.2 Two-Step Caching & Email OTP Verification

Every public self-registration (Customer credential signup) must be verified with a 6-digit one-time password (OTP) before the profile becomes usable. 
- During registration, the payload is serialized and preserved inside a **Redis Cache Store** mapped to the generated OTP code sent to the consumer's inbox.
- The record is only committed to the primary SQL database upon submission of a matching valid OTP token. Google registrations skip this step entirely, as the provider inherently guarantees identity verification.
### 3.3 Login & Unified Consumer Identity

- Customers log in with email/password or with Google — and it maps to the exact same account. A customer who originally registered via traditional credentials can seamlessly authenticate via Google later (matched dynamically by email), and vice versa; the backend prevents duplicate account generation.
- Operational and administrative actors authenticate using email and password credentials exclusively.

### 3.4 Token Issuance & Profile Aggregation (`getMe`)

- Every successful login or registration issues an encrypted **Access Token** and a long-lived **Refresh Token** delivered via secure HTTP-Only cookies to eliminate cross-site scripting vectors.
- The profile retrieval route (`/getMe`) dynamically checks the active session's role and structural boundaries. It automatically returns the main `User` data merged with specialized data (e.g., wallet and area records for Customers, or active dispatch tickets for Technicians).

### 3.5 Password Recovery & Settings Management

- **Forgot/Reset Password:** A two-step loop where the customer submits an email to receive a secure Redis-backed OTP, which they subsequently present alongside their new desired passphrase to overwrite old credentials.
- **Change Password:** For logged-in users who verify their active identity by passing their **current password** before committing a **new password** to the system.
- **Set Password (Google Signups Only):** A customer who onboarded purely via Google OAuth has no initial password. This feature allows them to initialize one, enabling subsequent dual-channel logins.

---

## 4. Grid Infrastructure Hierarchy

The platform models the physical electricity grid using a rigid, cascade-deleting relational model where child entities cannot exist outside an established branch:

### 4.1 Area Priority Metrics
To facilitate smart automated rationing during production deficits, every instantiated `Area` must be explicitly tagged with a structural `AreaPriority` classification:
- **`HOSPITAL`**: Healthcare networks requiring a near-zero load-shedding footprint.
- **`VIP`**: Critical security or high-economic-value operational grids.
- **`NORMAL`**: Standard residential and commercial networks.

---

## 5. Outage Engine and Maintenance Tracking

The platform isolates system power drops into two operational categories: **Scheduled Load Shedding** and **Unexpected Grid Outages**.

### 5.1 Unexpected Outages & Incident Deduplication
When a field asset fails (e.g., localized line breaks, distribution transformer explosions), the system coordinates the emergency state using strict deduplication safeguards:
1. A customer logs an incident report from their dashboard, adding an optional description of the failure.
2. The system executes a defensive scan for any un-restored `UNEXPECTED` outage rows currently active within that customer’s assigned `Area`.
3. If an un-restored outage is found, the system suppresses duplicate row generation in the core grid table and instead appends a new link record to the `OutageReport` logs, tracking consumer impact without cluttering database tables.
### 5.2 Automated Dispatch and Conflict Prevention
If the report represents a completely new grid breakdown event, a database transaction initializes to execute automated dispatch logic:
1. The system reads the area's structural parent `DistributionZone` ID via an inverse relational path.
2. It queries for a `Technician` profile attached to that specific zone whose current availability status is strictly set to **`AVAILABLE`**.
3. If an available technician is found, the system enforces **Conflict Detection** by immediately committing three atomic updates:
   - Locks the technician's status to **`ON_DUTY`** (preventing any alternative ticket assignment).
   - Provisions an active `OutageAssignment` link node.
   - Transitions the core grid outage status to **`ASSIGNED`**.
4. If no technicians are free, the system catches the condition safely, transitioning the grid outage status to **`ACTIVE`** to flag it for manual operator dispatch.

### 5.3 Restoration Tracking & Direct Resolution
When a field technician rectifies the line fault, they close the task via a single button click on their field portal:
1. The transaction automatically computes the absolute outage window by saving the precise system timestamp into the `endTime` field of the `Outage` row.
2. The technician’s status immediately resets from `ON_DUTY` back to **`AVAILABLE`**, returning them to the active dispatch pool.
3. The tracking ticket state transitions to **`RESTORED`**, updating all associated customer report nodes and automatically returning the area's live grid health status to normal on client dashboards.

---

## 6. Smart Wallet and Utility Token Engine

The system supports simulated prepaid smart grid account operations via card-based token architectures.

### 6.1 Stripe Checkout Sessions
Utility balance top-ups execute securely via hosted **Stripe Checkout Sessions**:
1. A customer requests a balance recharge, passing a target monetary value (enforcing a minimum threshold of \$0.50 USD to comply with international processing limits).
2. The system intercepts the request, maps the client's `userId` directly from the verified JWT header to enforce isolation, and provisions a unique Stripe session redirecting the client to an official checkout screen.
3. Upon payment completion, Stripe redirects the transaction back to a secure verification callback on the application server.

### 6.2 20-Digit Utility Token Generation (STS Emulation)
To mirror the real-world operational realities of physical off-grid prepaid meters (which are completely offline and rely on Standard Transfer Specification encryption protocols), the application implements an **STS Token Simulation Loop**:
1. Upon receiving a payment confirmation from the gate, the system **avoids** instantly updating the user's live database balance.
2. Instead, it computes the exact net utility units purchased (deducting simulated local taxes or fixed maintenance fees) and invokes an algorithm that yields a randomized, cryptographically secured **20-Digit Utility Passcode** split into five blocks of four distinct digits (e.g., `4829-1029-4823-9923-1283`).
3. This token is temporarily cached under the user's profile state as a pending transaction, and presented visually to the client as an un-punched utility code.

### 6.3 Meter Synchronization & Replay Protection
1. To finalize the transfer of funds into their account, the Customer must copy the 20-digit string and input it into an interface simulating their physical meter keypad.
2. The application verifies the passcode against the cached profile state. If the string contains an erroneous number, the system catches the error safely, triggering a strict validation exception.
3. If the passcode matches perfectly, the simulated net funds are transferred to the customer's active wallet balance, and the token state is immediately changed to **`NULL` / Spent**. This provides absolute **Anti-Replay Protection**, ensuring the identical passcode can never be re-used to inflate balances.
