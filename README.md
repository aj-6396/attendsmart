# Class Mark - Institutional Attendance Monitoring & Fraud Prevention System

[![React 19](https://img.shields.io/badge/React-19.2.5-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.4.2-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

**Class Mark** is an institutional-grade attendance monitoring and verification platform engineered to eliminate attendance fraud in universities, colleges, and higher-education institutions. By combining **Hardware Device Fingerprint Locking**, **Adaptive Multi-Sample Geo-Fencing (Haversine Formula)**, **Server-Side GPS Spoofing Detection**, and **Dynamic Time-Locked OTPs**, ClassMark guarantees 100% physical presence verification without the delays of manual roll calls or the vulnerabilities of static QR codes.

---

## 🌟 Security & Anti-Fraud Architecture

ClassMark is built on a **Zero-Trust Physical Presence** model designed to solve common campus attendance loopholes:

```
                               ┌──────────────────────────────────────────────┐
                               │             Student Device Check             │
                               └──────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
         [ 1. Device Hardware Locking ]                              [ 2. Geodesic Proximity ]
  • Native Hardware UUID (Capacitor)                          • Haversine Great-Circle algorithm
  • Web Browser Fingerprint (FingerprintJS)                   • Dynamic radius: 40m - 100m adaptive
  • Account locked to 1 physical device                       • Multi-sample averaging (3 samples)
  • Anti-Session-Sharing (1 phone ≠ 2 students)               • Rejects remote / hostel check-ins
                       │                                                             │
                       └──────────────────────────────┬──────────────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
         [ 3. GPS Spoof Detection ]                                  [ 4. Time-Locked OTP ]
  • Flags artificial accuracy (< 3m)                          • Cryptographically generated 4-digit code
  • Detects 0-variance mock coordinates                       • Strict 5-minute time-to-live (TTL)
  • Velocity anomaly check (> 30 m/s)                         • Strictly isolated to class cohort
                       │                                                             │
                       └──────────────────────────────┬──────────────────────────────┘
                                                      │
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │ 100% Verified Attendance ✅ │
                                       └─────────────────────────────┘
```

### 1. Hardware Device Locking (Anti-Proxy Guarantee)
- **Native Mobile**: Extracts true hardware device identifier via `@capacitor/device`.
- **Web & PWA**: Generates a resilient hardware signature using `@fingerprintjs/fingerprintjs` (canvas rendering, WebGL context, audio stack, hardware concurrency, screen depth, and system fonts).
- **Binding Rule**: When a student registers or marks attendance for the first time, their account binds to that physical handset in `student_profiles.device_id`.
- **Anti-Session Sharing**: Prevents students from logging into a friend's phone to mark attendance. The backend verifies that the device has not already been used by another student in that same session.
- **Hardware Recovery**: Faculty or Administrators can reset a student's device link with one click if they acquire a new phone.

### 2. Adaptive Geo-Fencing (Haversine Algorithm)
- Calculates geodesic great-circle distance between teacher and student coordinates:
  $$d = 2R \cdot \operatorname{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$
  where $R = 6,371,000\text{ m}$.
- **Dynamic Indoor Radius Calibration**: Adjusts acceptable proximity based on real-world GPS signal degradation inside concrete classrooms:
  - GPS Accuracy $\le 20\text{ m} \longrightarrow \text{Radius} = 40\text{ m}$
  - GPS Accuracy $\le 40\text{ m} \longrightarrow \text{Radius} = 60\text{ m}$
  - GPS Accuracy $\le 60\text{ m} \longrightarrow \text{Radius} = 80\text{ m}$
  - GPS Accuracy $> 60\text{ m} \longrightarrow \text{Radius} = 100\text{ m}$

### 3. Server-Side GPS Spoofing & Mock Location Detection
Before recording attendance, the server analyzes raw coordinate sample sequences:
- **Suspicious Accuracy**: Flags indoor accuracy $< 3\text{ m}$ (characteristic of mock GPS software).
- **Natural Variance Analysis**: Real satellite readings fluctuate slightly; exact coordinate duplicate readings across 3 samples trigger a mock location alert.
- **Velocity Verification**: Movement between consecutive 1-second readings exceeding $30\text{ m/s}$ ($108\text{ km/h}$) flags synthetic injection.

### 4. Offline Attendance Queue System
- When entering lecture halls with poor mobile coverage, attendance payloads are saved to local encrypted persistent storage (`@capacitor/preferences`).
- When network connectivity returns, ClassMark auto-detects the connection and flushes queued items to the server with instant push confirmation.

---

## 🏫 Feature Set by Role

### 👨‍🎓 For Students (Learner Terminal)
* **Class Cohorts**: Join academic subjects via 6-character Join Codes issued by professors.
* **Instant Punching**: Input 4-digit session OTP with live GPS accuracy meter and progress feedback.
* **Academic Dashboard**: Subject-isolated attendance logs, timestamps, and instructor details.
* **SVG Attendance Gauge**: Visual percentage ring chart with breakdown of attended vs. absent lectures.
* **Danger Zone Warning**: Prompts alert banners and toasts when attendance falls below the **75% institutional threshold**.
* **Push Notifications**: Real-time push alerts when a professor initiates a session and automated **5:00 PM absence summaries**.

### 👩‍🏫 For Teachers (Faculty Command)
* **Cohort Management**: Create custom classes and generate distinct 6-character alphanumeric Join Codes. Supports co-teachers.
* **Live Presence Monitor**: Subscribes to Supabase Realtime WAL replication to watch student names populate live as they submit OTPs.
* **Manual Override**: Mark attendance manually for students facing temporary GPS or hardware issues (audited with `manual: true`).
* **Session Lifecycle**: Real-time countdown timer, early session termination, and deletion of erroneous sessions.
* **Roster Management**: Search roster by name or enrollment number with percentage bars.
* **One-Click Institutional Exports**:
  * **Landscape A4 PDF**: Formal attendance register sorted by Examination Roll Number with green/red badges generated via `jspdf-autotable`.
  * **Complete CSV Matrix**: Full matrix spreadsheet export with lecture dates, attendance status (`P`/`A`), total present, and percentage.
* **Student Security Support**: Reset forgotten 6-digit student PINs or unlink registered devices.

### 🛡️ For Administrators (Executive Center)
* **System-Wide Telemetry**: Live metrics for total students, faculty members, active classes, and sessions.
* **7-Day Trend Analytics**: Interactive Recharts Area Chart displaying institutional check-in volume and week-over-week percentage growth.
* **Critical Roster Monitor**: Institution-wide radar listing all students under 75% attendance.
* **Faculty Provisioning**: Onboard new faculty accounts with Personnel ID, email, and 6-digit PIN.
* **System Report PDF**: Comprehensive administrative PDF summarizing institutional attendance health and critical rosters.

---

## 🛠️ Technology Stack

```
├── Frontend: React 19, TypeScript, Tailwind CSS v4, Motion (Framer Motion v12)
├── Mobile / Hybrid: Capacitor 8 (Android & iOS Native Shell), PWA (Vite PWA)
├── Visualization & Export: Recharts, jsPDF, AutoTable, Lucide Icons
├── Backend API: Vercel Serverless Functions (/api/*), Node.js, Express types
├── Database: Supabase PostgreSQL 15+, Row Level Security (RLS), Realtime WAL Replication
└── Observability: Vercel Web Analytics, Speed Insights
```

---

## 🗄️ Database Architecture

The PostgreSQL schema is fully secured with Row Level Security (RLS) policies and security-definer helper functions (`is_admin()`, `is_teacher()`):

| Table | Purpose |
| :--- | :--- |
| `users` | Primary identity table extending Supabase auth (`id`, `name`, `role: student/teacher/admin`). |
| `student_profiles` | Student identity (`enrollment_no`, `exam_roll_no`, `course`, `semester`, `major_subject`, `batch`, `section`, `device_id`). |
| `teacher_profiles` | Faculty identity (`employee_id`, `department`). |
| `classes` | Class cohorts (`name`, `join_code`, `created_by`). |
| `class_teachers` | Junction table for co-teaching permissions. |
| `class_enrollments` | Junction table tracking student class memberships. |
| `attendance_sessions` | Teacher sessions with coordinates, 4-digit OTP, expiration timestamp, accuracy, and active status. |
| `attendance_records` | Attendance ledger with coordinates, student ID, session ID, device ID, and manual flags. |

---

## 📋 Enrollment & Validation Constraints

To preserve data integrity, the following format rules are enforced on the client and server:

* **Enrollment Number**: Exactly **6 numerical digits** (`^\d{6}$`).
* **Examination Roll Number**: Exactly **11 alphanumeric characters** (`^[a-zA-Z0-9]{11}$`).
* **Security PIN**: Exactly **6 numerical digits** (`^\d{6}$`).
* **Session OTP**: Exactly **4 numerical digits** with a **5-minute validity window**.

---

## 🚀 Getting Started & Setup

### Prerequisites
* Node.js 18+ & npm
* Supabase account & project
* (Optional) Android Studio for building native Android APK

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/classmark.git
cd classmark
npm install
```

### 2. Database Migration
Run the SQL scripts in your Supabase SQL Editor:
1. Execute [`supabase_schema.sql`](file:///c:/Users/Dell/Desktop/classmark/attendsmart/supabase_schema.sql) (creates tables, indices, RLS policies, and Realtime publications).
2. Execute [`supabase_migrations.sql`](file:///c:/Users/Dell/Desktop/classmark/attendsmart/supabase_migrations.sql) (applies updates, device locking columns, and class permissions).

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Development Server
```bash
# Start Vite development server
npm run dev

# Or run with Vercel CLI to test serverless functions locally
npx vercel dev
```

### 5. Native Android Build (Capacitor)
```bash
# Build production web bundle
npm run build

# Sync web assets with native Android shell
npx cap sync android

# Open in Android Studio to build APK or run on device
npx cap open android
```

---

## 📄 License & Intellectual Property

Copyright © 2026 **Ambuj Singh**. All Rights Reserved.  
This software and associated documentation files are proprietary and confidential.  
Developed by [Ambuj Singh](https://aj-7portfolio.vercel.app/).
