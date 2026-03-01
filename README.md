## 🔐 Role-Based Demo Access

UIIP implements role-based access control to simulate real municipal infrastructure governance.

The following accounts are available for demonstration:

| Role     | Username              | Password    |
|----------|----------------------|------------|
| Admin    | admin@city.gov       | admin123   |
| Operator | operator@city.gov    | operator123|
| Viewer   | viewer@city.gov      | viewer123  |


# 🌆 UIIP — Urban Intelligence Infrastructure Platform

> **A City-Scale Geospatial Digital Twin for Monitoring, Predicting, and Simulating Urban Infrastructure Risk**

---

## 🚀 Overview

**UIIP (Urban Intelligence Infrastructure Platform)** is a frontend-driven urban intelligence system that transforms static infrastructure datasets into a **real-time, interactive Digital Twin**.

The platform enables cities to move from **reactive infrastructure maintenance** toward **predictive and simulation-based decision making** — directly inside the browser.

UIIP goes beyond visualization by integrating monitoring, analytics, and infrastructure risk simulation into a unified intelligence layer.

---

## 🎯 Core Capabilities

✅ Monitor infrastructure health in real time
✅ Predict asset failure risk
✅ Simulate disaster propagation
✅ Model temporal degradation patterns
✅ Track infrastructure audit history
✅ Enable decision-ready urban intelligence

---

## 🧠 Project Vision

Modern cities typically operate **reactively**, repairing infrastructure only after failures occur.

UIIP introduces a new paradigm:

> **Predict → Simulate → Prevent**

By combining geospatial visualization with analytics pipelines, the system helps planners anticipate failures before they impact citizens.

---

## 🏗️ System Architecture

```
Frontend (Digital Twin UI)
        ↓
Simulation & Analytics Engine
        ↓
Supabase Backend (PostgreSQL + Views)
        ↓
Infrastructure Data Models
```

### Key Layers

* Interactive Map Interface
* Simulation Engine
* Analytics & Health Indexing
* Database Views & Audit Logs
* Infrastructure Risk Modeling

---

## 🛠️ Tech Stack

| Layer         | Technology                    |
| ------------- | ----------------------------- |
| Frontend      | React + TypeScript + Vite     |
| Visualization | Map-based Geospatial UI       |
| Backend       | Supabase                      |
| Database      | PostgreSQL                    |
| Analytics     | SQL Views & Performance Index |
| Deployment    | Vercel                        |

---

## 🗄️ Database Setup

The repository includes complete schema files required to recreate the backend.

### Steps

1. Create a new **Supabase Project**
2. Open **SQL Editor**
3. Execute SQL files in order:

```
phase2_infrastructure_schema.sql
phase5_*.sql
phase6_analytics_views.sql
phase7_*.sql
supabase_setup.sql
```

This will automatically configure:

* Infrastructure tables
* Analytics views
* Audit logs
* Simulation datasets

---

## ⚙️ Environment Configuration

Create a `.env` file:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## ▶️ Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Application runs at:

```
http://localhost:5173
```

---

## 📁 Project Structure

```
UIIP/
│
├── public/
├── src/
│
├── database/
│   ├── schema.sql
│   ├── analytics_views.sql
│   └── seed_data.sql
│
├── README.md
├── package.json
└── vite.config.ts
```

---

## 🔬 Key Features Implemented

* Digital Twin Map View
* Asset Health Monitoring
* Failure Simulation Engine
* Performance Index Modeling
* Infrastructure Audit Tracking
* Recovery & Integrity Analysis

---

## 🧭 Future Roadmap

* AI-based failure prediction
* Multi-city scaling
* Real-time streaming data
* Infrastructure optimization engine
* Scenario comparison dashboard

---

## 👨‍💻 Team

**UIIP Development Team**
* TEJVIR SINGH
* VANSHIAK SHARMA
* AMBERJEET SINGH

---

## 🏆 Hackathon Note

This project demonstrates a **software-only city intelligence platform** capable of simulation, analytics, and predictive infrastructure management without requiring physical sensors.

---

## 📄 License

This project is developed for academic and hackathon purposes.
