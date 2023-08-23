const aws = require("aws-sdk");
const multer = require("multer");
const multers3 = require("multer-s3");

exports.setProfilePic = (req, res, next) => {
  console.log(req.files);

  res.status(200).json({ data: req.files });
};
