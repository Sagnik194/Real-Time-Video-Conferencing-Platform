import "dotenv/config";



import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";

import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";

const app = express();
const server = createServer(app);

connectToSocket(server);

app.set("port", process.env.PORT || 8000);
app.set('trust proxy', 1);

const defaultOrigins = ['https://real-time-video-conferencing-platform-de4t.onrender.com', 'http://localhost:3000'];
const allowedOrigins = (process.env.CLIENT_ORIGIN || defaultOrigins.join(',')).split(',').map(value => value.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

app.use("/api/v1/users", userRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
app.use((error, _req, res, _next) => {
    console.error('Request failed:', error?.name || 'Error');
    res.status(error.status || 500).json({ message: error.status && error.status < 500 ? error.message : 'An unexpected error occurred.' });
});

const start = async () => {
    try {
        console.log("Connecting to MongoDB Atlas...");
        console.log("MongoDB URI loaded:", !!process.env.MONGO_URI);

        if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');
        const connectionDb = await mongoose.connect(
            process.env.MONGO_URI,
            {
                family: 4,
                serverSelectionTimeoutMS: 10000
            }
        );

        console.log(
            `MONGO Connected DB HOST: ${connectionDb.connection.host}`
        );

        server.listen(app.get("port"), () => {
            console.log(
                `LISTENING ON PORT ${app.get("port")}`
            );
        });

    } catch (error) {
        console.error('MongoDB connection failed:', error?.name || 'Error');
        process.exit(1);
    }
};

start();
