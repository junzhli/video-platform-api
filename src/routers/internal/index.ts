import express from "express";
import { requestCSRFToken, setSession } from "../../controllers/internal";
import csrfProtection from "../../middlewares/csurf";

export default () => {
    const router = express.Router();

    router.get("/requestCSRFToken", csrfProtection, requestCSRFToken);

    router.get("/setSession", setSession);

    return router;
};