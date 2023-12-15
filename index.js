const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const router = require("./routes");
const myConfig = require("./config");

const { listBuckets } = require("./utils/aws");

const app = express();
require("dotenv").config();

const logger = require("./utils/logger");

app.use(cors());
app.use(express.json());

app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({ message: "API Version 1" });
});

// an endpoint to list all buckets
app.get("/buckets", async (req, res) => {
  try {
    const buckets = await listBuckets();
    res.status(200).json(buckets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list buckets" });
  }
});

app.use(router);

const cronJobs = require("./cronjobs");

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("Server listening on port ", port);
});
