const multer = require("multer");
// const AWS = require("aws-sdk");

const {
  S3Client,
  PutObjectCommand,
  ListBucketsCommand,
} = require("@aws-sdk/client-s3");

const region = "eu-north-1";

const s3_v3 = new S3Client({
  region: region,
  credentials: {
    accessKeyId: process.env.S3_BUCKET_ACCESS_KEY,
    secretAccessKey: process.env.S3_BUCKET_SECRET_KEY,
  },
});

// const s3 = new AWS.S3({
//   accessKeyId: process.env.S3_BUCKET_ACCESS_KEY,
//   secretAccessKey: process.env.S3_BUCKET_SECRET_KEY,
// });

const validFileTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  // "text/csv",
  // "text/plain",
  // "application/pdf",
  // "application/mspowerpoint",
  // "application/msword",
  // "application/excel",
  "audio/mpeg",
  "audio/mp4",
  "audio/mp3",
  "audio/ogg",
  "audio/vnd.wav",
  "audio/wave",
  // "video/mp4",
  // "video/3gpp",
  // "video/quicktime",
  // "video/x-ms-wmv",
  // "video/x-msvideo",
  // "video/x-flv",
];

const storage = multer.memoryStorage();

// Create multer upload instance with fileFilter
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (validFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type."));
    }
  },
});

// const uploadFile = (filename, bucketname, folder, file, contentType) => {
//   return new Promise((resolve, reject) => {
//     const key = folder ? `${folder}/${filename}` : filename;

//     const params = {
//       Key: key,
//       Bucket: bucketname,
//       Body: file,
//       ContentType: contentType,
//       ACL: "public-read",
//     };

//     s3.upload(params, (err, data) => {
//       if (err) {
//         reject(err);
//       } else {
//         resolve(data.Location);
//       }
//     });
//   });
// };

const uploadFile = async (filename, bucketname, folder, file, contentType) => {
  const key = folder ? `${folder}/${filename}` : filename;

  const params = {
    Key: key,
    Bucket: bucketname,
    Body: file,
    ContentType: contentType,
    ACL: "public-read",
  };

  try {
    const command = new PutObjectCommand(params);
    await s3_v3.send(command);
    const url = `https://${bucketname}.s3.${region}.amazonaws.com/${encodeURIComponent(
      key
    )}`;
    return url;
  } catch (err) {
    throw err;
  }
};

// list all folders in bucket
const listBuckets = async () => {
  const command = new ListBucketsCommand({});
  try {
    const data = await s3_v3.send(command);
    return data.Buckets;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  upload,
  uploadFile,
  listBuckets,
};
