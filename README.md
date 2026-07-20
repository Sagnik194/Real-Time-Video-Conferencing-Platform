# 🎥 Video Conferencing Platform

A full-stack real-time video conferencing application inspired by Zoom, built using the **MERN Stack**. The platform enables users to securely create and join meetings, communicate through high-quality video and audio calls, exchange real-time messages, share screens, and maintain meeting history.

---

## 🚀 Features

- 🔐 User Authentication & Authorization using JWT
- 📹 Create and Join Video Meetings
- 🎙️ Real-Time Audio & Video Communication
- 💬 Real-Time Chat Messaging
- 🖥️ Screen Sharing Support
- 🎤 Mute / Unmute Microphone
- 📷 Turn Camera On / Off
- 📝 Meeting History Management
- 🛡️ Protected Routes using Authentication Middleware
- 📱 Fully Responsive User Interface

---

## 🛠️ Tech Stack

### Frontend
- React.js
- React Router DOM
- Context API
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- Mongoose

### Real-Time Communication
- Socket.IO
- WebRTC
- STUN Server

### Authentication & Security
- JWT (JSON Web Token)
- bcrypt.js
- CORS

### Development Tools
- Git
- GitHub
- Postman
- npm

---

## 📂 Project Structure

```text
video-conferencing-platform/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── socket/
│   ├── utils/
│   ├── server.js
│   └── package.json
│
├── screenshots/
├── README.md
└── .gitignore
```

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/video-conferencing-platform.git
```

### 2. Navigate to the Project

```bash
cd video-conferencing-platform
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

---

## 🔑 Environment Variables

Create a `.env` file inside the **backend** folder.

```env
PORT=8000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret
```

---

## ▶️ Running the Application

### Start Backend

```bash
cd backend
npm start
```

### Start Frontend

```bash
cd frontend
npm start
```

The application will be available at:

```
Frontend: http://localhost:3000
Backend : http://localhost:8000
```

---

## 🌐 Application Workflow

1. Users register and log in securely.
2. Authenticated users create or join meeting rooms.
3. Socket.IO handles signaling between connected participants.
4. WebRTC establishes peer-to-peer video and audio connections.
5. Participants can:
   - Communicate through live video and audio
   - Exchange real-time chat messages
   - Share their screens
   - Toggle microphone and camera
6. Meeting information is stored in MongoDB for future reference.

---

## 📸 Screenshots

Add your screenshots in the `screenshots` folder.

```text
screenshots/
├── home-page.png
├── login-page.png
├── register-page.png
├── dashboard.png
├── meeting-room.png
├── video-call.png
├── chat-window.png
└── meeting-history.png
```

Then display them like this:

```markdown
## Home Page

![Home](screenshots/home-page.png)

## Login Page

![Login](screenshots/login-page.png)

## Meeting Room

![Meeting Room](screenshots/meeting-room.png)

## Chat Window

![Chat](screenshots/chat-window.png)
```

---

## 🎯 Learning Outcomes

This project helped me gain practical experience in:

- Building scalable MERN Stack applications
- Implementing real-time communication with Socket.IO
- Establishing peer-to-peer connections using WebRTC
- Managing secure authentication and authorization with JWT
- Designing RESTful APIs using Express.js
- Integrating MongoDB with Mongoose
- Handling real-time signaling and event-driven architecture
- Developing responsive and interactive user interfaces
- Structuring and deploying full-stack applications

---

## 🔮 Future Enhancements

- Waiting Room functionality
- Meeting Recording
- File Sharing
- Virtual Background Support
- Live Captions
- Breakout Rooms
- Meeting Scheduling
- Email Invitations
- Push Notifications
- Admin Dashboard

---


