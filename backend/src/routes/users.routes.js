import { Router } from "express";
import { addToHistory, getUserHistory, login, logout, register } from "../controllers/user.controller.js";
import { loginRateLimiter, registrationRateLimiter } from "../middleware/authRateLimiters.js";



const router = Router();

router.route("/login").post(loginRateLimiter, login)
router.route("/register").post(registrationRateLimiter, register)
router.route("/logout").post(logout)
router.route("/add_to_activity").post(addToHistory)
router.route("/get_all_activity").get(getUserHistory)

export default router;
