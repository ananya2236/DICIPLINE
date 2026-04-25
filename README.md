# Discipline Tracker

A full-stack personal productivity and discipline tracking web application.

## Tech Stack
- **Frontend**: React (Vite) + Tailwind CSS v4
- **Backend**: Node.js + Express
- **Database**: Firebase Firestore
- **Auth**: Firebase Google Login

## Setup Instructions

### 1. Firebase Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Enable **Authentication** and enable **Google Login**.
4. Enable **Firestore Database**.
5. Create a Web App and copy the configuration.

### 2. Client Setup
1. Navigate to the `client` folder.
2. Create a `.env` file based on `.env.example`.
3. Fill in your Firebase credentials.
4. Run:
   ```bash
   npm install
   npm run dev
   ```

### 3. Server Setup
1. Navigate to the `server` folder.
2. Run:
   ```bash
   npm install
   npm start
   ```

## Key Features
- **Daily Discipline Tracker**: 30-day grid to track daily tasks (DSA, Core Study, Project, Fitness, etc.).
- **DSA Tracker**: Detailed logging for DSA practice sessions.
- **Command Center**: Dashboard with streaks, consistency metrics, and quick actions.
- **Analytics**: Visual charts for performance tracking.
- **Reflections**: Daily debrief system for continuous improvement.
- **Notifications**: Browser-based reminders for daily execution.
