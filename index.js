const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const router = require("./routes");

const app = express();
require("dotenv").config();

const logger = require("./utils/logger");

app.use(cors());
app.use(express.json());

app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({ message: "API Version 1" });
});

app.use(router);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Server listening on port ", port);
});
