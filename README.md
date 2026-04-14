# Class Mark - Real-Time Attendance Monitoring System

Class Mark is a secure, location-aware, and real-time attendance tracking application designed for educational institutions. It allows teachers to create live attendance sessions and students to mark their presence securely using OTP and GPS verification.

## 🌟 Features

### For Teachers
* **Live Sessions**: Create time-bound attendance sessions with a unique 6-digit OTP.
* **Location-Aware**: Sessions capture the teacher's GPS coordinates to ensure students are physically present in the classroom.
* **Real-Time Tracking**: Watch students mark their attendance in real-time.
* **Manual Override**: Manually mark students as present if they face technical difficulties.
* **Export Data**: Download attendance records as CSV files.
* **Student Management**: View student attendance statistics and reset student passwords (PINs).

### For Students
* **Easy Marking**: Mark attendance by entering the session OTP provided by the teacher.
* **GPS Verification**: The system verifies the student's location against the teacher's location to prevent proxy attendance.
* **Attendance History**: View past attendance records and overall attendance percentage.

### For Administrators
* **User Management**: Oversee all users (students and teachers) in the system.
* **System Oversight**: Full access to all attendance records and sessions.

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion, Lucide Icons
* **Backend**: Node.js, Express (Custom server for secure API routes)
* **Database & Auth**: Supabase (PostgreSQL, Row Level Security, Realtime Subscriptions)
* **Language**: TypeScript

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher)
* A Supabase account and project

### 1. Environment Setup
Create a `.env` file in the root directory and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Database Setup
Run the provided SQL schema in your Supabase SQL Editor to set up the necessary tables, Row Level Security (RLS) policies, and Realtime publications.

1. Open your Supabase Dashboard.
2. Go to the SQL Editor.
3. Copy the contents of `supabase_schema.sql` and run it.

### 3. Installation
Install the project dependencies:

```bash
npm install
```

### 4. Running the Development Server
Start the full-stack development server (Express + Vite):

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## 🔐 Security Features

* **Strict Role-Based Access Control (RBAC)**: Enforced via Supabase Row Level Security (RLS).
* **Location Spoofing Prevention**: Calculates the Haversine distance between the student and teacher to ensure proximity.
* **Time-Bound Sessions**: OTPs automatically expire to prevent delayed proxy marking.
* **PIN Authentication**: Uses strict 6-digit numeric PINs for streamlined yet secure student access.

## 👨‍💻 Creating the First Admin
To set up the initial administrator account:
1. Sign up as a student or teacher via the app interface.
2. Go to your Supabase SQL Editor.
3. Run the following command (replace `YOUR_USER_ID` with your actual auth.users ID):
   ```sql
   UPDATE public.users SET role = 'admin' WHERE id = 'YOUR_USER_ID';
   ```
