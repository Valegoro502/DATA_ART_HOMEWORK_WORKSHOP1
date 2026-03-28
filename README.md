# Classic Web Chat

A classic web-based online chat application, fulfilling the DataArt Workshop assignment.

## Features Included
- **User Authentication**: Register, Login, DB-backed Sessions.
- **Real-time Chat**: Built with Socket.IO for minimal latency.
- **Rooms & Friends**: Public and private rooms, direct messaging endpoints.
- **File Uploads**: Supports local file storage up to 20MB (3MB for images).
- **Presence Status**: Multi-tab synchronized AFK detection logic.

## Prerequisites
- Docker
- Docker Compose

## Running the Application

This project is fully containerized. To spin up the backend, frontend, and PostgreSQL database, simply run:

```bash
docker compose up --build
```

- The Frontend will be available at `http://localhost` (or `http://localhost:80`).
- The Backend API will be available at `http://localhost:3000`.
- The Database will run on `localhost:5432`.

## Admin password

Email: admin@gmail.com
Password: admin