const express = require("express");
const axios = require("axios");
const morgan = require("morgan");

const app = express();
require("dotenv").config();

// const upload = multer({ storage });
const { upload, uploadFile } = require("./utils/aws");
const logger = require("./utils/logger");

app.use(express.json());

app.use(morgan("dev"));

const {
  storeAudio,
  getAllAudio,
  getAudioById,
} = require("./controllers/audioController");

const {
  getAllCategories,
  addCategory,
  editCategoryName,
  deleteCategory,
} = require("./controllers/categoryController");

const port = process.env.PORT || 3000;
const plan = process.env.PAYSTACK_PLAN_CODE;

app.post("/paystack/initialize-transaction", async (req, res) => {
  try {
    const { amount, email } = req.body;
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        amount,
        email,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.log(error);
    res.status(error.response.status).json({ error: error.message });
  }
});

app.get("/", async (req, res) => {
  res.status(200).json({ message: "Version 1" });
});

// Confirm Paystack Transaction Status
app.get("/paystack/confirm/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const { status, amount } = response.data.data;
    res.json({ status, amount });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error confirming Paystack transaction status");
  }
});

//upload audio
app.post("/audio/upload", upload.single("audiofile"), async (req, res) => {
  try {
    const filename = req.file.originalname;
    const folder = "audio";
    const bucketname = process.env.S3_BUCKET_BUCKET_NAME;
    const file = req.file.buffer;
    const contentType = req.file.mimetype;

    const link = await uploadFile(
      filename,
      bucketname,
      folder,
      file,
      contentType
    );
    console.log({ status: "success", link });
    res.send({ status: "success", link });
  } catch (error) {
    console.log("Error uploading file:", error);
    res.status(500).send({ status: "error" });
  }
});

app.post("/thumb/upload", upload.single("thumbfile"), async (req, res) => {
  try {
    const thumbFilename = req.file.originalname;
    const thumbFolder = "thumbs";
    const bucketname = process.env.S3_BUCKET_BUCKET_NAME;
    const thumbFile = req.file.buffer;
    const thumbContentType = req.file.mimetype;

    const thumbLink = await uploadFile(
      thumbFilename,
      bucketname,
      thumbFolder,
      thumbFile,
      thumbContentType
    );
    console.log({ status: "success", thumbLink });
    res.send({ status: "success", thumbLink });
  } catch (error) {
    console.log("Error uploading thumb:", error);
    res.status(500).send({ status: "error" });
  }
});

app.post("/audio", storeAudio);
app.get("/audio", getAllAudio);
app.get("/audio/:id", getAudioById);

//categories endpoints
app.get("/category", getAllCategories);
app.post("/category", addCategory);
app.put("/category/:categoryId", editCategoryName);
app.delete("/category/:categoryId", deleteCategory);

app.listen(port, () => {
  console.log("Server listening on port ", port);
});
