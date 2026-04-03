import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatbotRoutes from "./routes/chatbot.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend
app.use(cors({ origin: "http://localhost:8080", credentials: true }));

// Parse JSON bodies
app.use(express.json());

// Mount chatbot routes
app.use("/api/chatbot", chatbotRoutes);

// Test GET route for chatbot endpoint
app.get("/api/chatbot/chat", (req, res) => {
  res.json({ message: "Use POST method for chatbot" });
});

// Health check
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("[Express Error]", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`GigConnect backend running on port ${PORT}`);
});
