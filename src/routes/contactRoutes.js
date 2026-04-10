import express from "express";
import { submitContactRequest } from "../controllers/contactController.js";

const router = express.Router();

// POST /api/v1/contact
router.post("/", submitContactRequest);

export default router;