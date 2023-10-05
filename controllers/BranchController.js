const express = require("express");
const router = express.Router();

const BranchService = require("../services/BranchService");
const BranchModel = require("../models/BranchesModel");
const authMiddleware = require("../middlewares/authMiddleware");

const geocodeAddress = require("../utils/geoCoding");

const branchService = new BranchService(BranchModel);

router.get("/", async (req, res) => {
  try {
    const branches = await branchService.getAllBranches();
    res.status(200).json({ status: "success", branches: branches });
  } catch (error) {
    console.error("Error fetching branches:", error);
    res
      .status(500)
      .send({ error: "An error occurred while fetching branches." });
  }
});

router.post("/", async (req, res) => {
  const { name, stateId, address, type, isHQ } = req.body;

  // Call the geocodeAddress function to obtain coordinates
  geocodeAddress(address)
    .then((coordinates) => {
      console.log("Coordinates:", coordinates);

      // Extract latitude and longitude from coordinates
      const { latitude, longitude } = coordinates;

      // Format the coordinates as POINT(longitude latitude)
      const location = `POINT(${longitude} ${latitude})`;

      // Call your service's addBranch method to save the data
      branchService
        .addBranch(name, stateId, address, location, type, isHQ)
        .then((result) => {
          console.log("Branch added with ID:", result);

          // Send a response indicating success
          res.status(201).json({ status: "success", branchId: result });
        })
        .catch((error) => {
          console.log(error);
          console.error("Error adding branch:", error.message);

          // Send a response indicating an error
          res
            .status(500)
            .json({ status: "error", message: "Error adding branch" });
        });
    })
    .catch((error) => {
      console.error("Error:", error.message);

      // Send a response indicating an error
      res
        .status(500)
        .json({ status: "error", message: "Error geocoding address" });
    });
});

module.exports = router;
