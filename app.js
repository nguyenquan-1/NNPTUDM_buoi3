const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// Cho phép truy cập file CSS trong public/
app.use(express.static(path.join(__dirname, "public")));

// Route dashboard
const dashboardRoute = require("./routes/dashboard.route");
app.use("/dashboard", dashboardRoute);

// Run server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});