import express from "express";
import Groq from "groq-sdk";
import { getPool } from "../backend/db/pool.js";
import { verifyToken } from "./verifyToken.js";

const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are an AI assistant for GigConnect, a multi-vendor service platform.\n\nServices available:\n- Plumbing\n- Electrical\n- AC Repair\n- Cleaning\n- Salon\n\nHelp users:\n- Find services\n- Understand pricing\n- Guide booking process\n- Explain vendor dashboard`;

router.post("/chat", verifyToken, async (req, res) => {
  try {
    // Input validation
    if (!req.body || typeof req.body.message !== "string" || !req.body.message.trim()) {
      return res.status(400).json({ error: "Message is required and must be a non-empty string." });
    }
    const message = req.body.message.trim();
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const pool = getPool();

    // Save user message
    await pool.query(
      "INSERT INTO chats (user_id, role, message) VALUES ($1, $2, $3)",
      [userId, "user", message]
    );

    // Send to Groq
    const completion = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a reply.";

    // Save bot reply
    await pool.query(
      "INSERT INTO chats (user_id, role, message) VALUES ($1, $2, $3)",
      [userId, "bot", reply]
    );

    res.json({ reply });
  } catch (err) {
    console.error("[Chatbot Error]", err);
    res.status(500).json({ error: "Chatbot failed. Please try again later." });
  }
});

export default router;
