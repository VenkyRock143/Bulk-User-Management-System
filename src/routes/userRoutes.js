const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/userController");

// ─── Export routes (must come before /:id to avoid collision) ─────────────────
router.get("/export/stats", ctrl.exportStats);
router.get("/export",       ctrl.exportUsers);
router.get("/stats",        ctrl.getUserStats);

// ─── Bulk operations ──────────────────────────────────────────────────────────
router.post  ("/bulk",   ctrl.bulkCreateUsers);
router.patch ("/bulk",   ctrl.bulkUpdateUsers);
router.delete("/bulk",   ctrl.bulkDeleteUsers);

// ─── Single user CRUD ─────────────────────────────────────────────────────────
router.get  ("/",    ctrl.getUsers);
router.post ("/",    ctrl.createUser);
router.get  ("/:id", ctrl.getUserById);
router.patch("/:id", ctrl.updateUser);
router.delete("/:id", ctrl.deleteUser);

module.exports = router;