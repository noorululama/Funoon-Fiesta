# Polling & Prediction Features - Integration & Usage Guide

## Overview
We have successfully implemented the **Polling System** and **Prediction Feature**. These systems are integrated with MongoDB for data persistence and Pusher for real-time updates.

## New Features

### 1. Polling System
-   **Admin**: Create polls with custom questions and options. Delete active polls.
    -   Location: `/admin/polls`
-   **User**: View active polls and vote in real-time.
    -   Location: `/polls`
    -   **Security**: Voting is restricted to one vote per poll (validated via IP/User-Agent hash for simplicity).
-   **Real-time**: Results bars animate smoothly and update instantly when votes come in.

### 2. Prediction System
-   **Admin**: Create prediction events (e.g., "Who will win Program X?"). Can manually evaluate outcomes or rely on auto-evaluation.
    -   Location: `/admin/predictions`
-   **User**: Predict outcomes before the deadline. Points are awarded for correct predictions.
    -   Location: `/predictions`
-   **Leaderboard**: A ranking of users based on total prediction points.
    -   Location: `/predictions/leaderboard`
-   **Auto-Evaluation**: When a Result is **Approved** by the admin in the Results section, the system automatically checks for matching prediction events and awards points to winners.

## Files Created/Modified
-   **Models**: Added `Poll`, `Vote`, `PredictionEvent`, `Prediction`, `UserScore` to `src/lib/models.ts`.
-   **API**:
    -   `src/app/api/polls/*`
    -   `src/app/api/predictions/*`
-   **UI Components**:
    -   `src/components/polls/PollCard.tsx`, `PollChart.tsx`
    -   `src/components/predictions/PredictionCard.tsx`, `LeaderboardTable.tsx`
-   **Pages**:
    -   Admin: `src/app/admin/(secure)/polls`, `src/app/admin/(secure)/predictions`
    -   Public: `src/app/polls`, `src/app/predictions`

## Integration Steps
The system is fully integrated. No manual steps are required to enable it, other than ensuring your environment variables are set.

### Environment Variables Required
Ensure you have these in your `.env.local`:
```env
MONGODB_URI=...
PUSHER_APP_ID=...
NEXT_PUBLIC_PUSHER_KEY=...
PUSHER_SECRET=...
NEXT_PUBLIC_PUSHER_CLUSTER=...
```

### How to Test
1.  **Polls**:
    -   Go to `/admin/polls` and create a poll.
    -   Go to `/polls` and try voting.
    -   Open `/polls` in a second browser window to see the vote update in real-time.
2.  **Predictions**:
    -   Go to `/admin/predictions` and create an event for a specific program (e.g., "Mappilapattu").
    -   Go to `/predictions` and make a prediction.
    -   Go to the Jury/Admin result entry page, submit and **Approve** a result for that program.
    -   Check `/predictions/leaderboard` to see if points were awarded.
