const router = require("express").Router();
const { getAll } = require("../controllers/dashboard.controller");

// URL: http://localhost:3000/dashboard/products
router.get("/products", getAll);

module.exports = router;
