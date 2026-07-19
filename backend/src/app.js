import "dotenv/config";

import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

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

app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);

const start = async () => {
    try {
        console.log("Connecting to MongoDB Atlas...");
        console.log("MongoDB URI loaded:", !!process.env.MONGO_URI);

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
        console.error("MongoDB connection failed:");
        console.error(error);
        process.exit(1);
    }
};

start();