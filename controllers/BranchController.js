const express = require("express");
const router = express.Router();

const BranchService = require("../services/BranchService");
const BranchModel = require("../models/BranchesModel");
const authMiddleware = require("../middlewares/authMiddleware");

const geocodeAddress = require("../utils/geoCoding");
const { log } = require("winston");

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

router.get("/higher-institutions", async (req, res) => {
  try {
    const branches = await branchService.getHigherInstitutionBranches();
    res.status(200).json({ status: "success", branches: branches });
  } catch (error) {
    console.error("Error fetching higher institution branches:", error);
    res
      .status(500)
      .send({ error: "An error occurred while fetching branches." });
  }
});

router.get("/state-branches", async (req, res) => {
  try {
    const branches = await branchService.getStateBranches();
    res.status(200).json({ status: "success", branches: branches });
  } catch (error) {
    console.error("Error fetching state branches:", error);
    res
      .status(500)
      .send({ error: "An error occurred while fetching branches." });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  const {
    name,
    stateId,
    address,
    type,
    website,
    phone,
    isHQ,
    latitude,
    longitude,
  } = req.body;

  // Format the coordinates as POINT(longitude latitude)
  const location = `POINT(${longitude} ${latitude})`;

  // Call your service's addBranch method to save the data
  branchService
    .addBranch(name, stateId, address, location, type, website, phone, isHQ)
    .then((result) => {
      console.log("Branch added with ID:", result);

      // Send a response indicating success
      res.status(201).json({ status: "success", branchId: result });
    })
    .catch((error) => {
      console.error("Error adding branch:", error.message);

      // Send a response indicating an error
      res.status(500).json({ status: "error", message: "Error adding branch" });
    });
});

// router.post("/", async (req, res) => {
//   const { name, stateId, address, type, website, phone, isHQ } = req.body;

//   // Call the geocodeAddress function to obtain coordinates
//   geocodeAddress(address)
//     .then((coordinates) => {
//       console.log("Coordinates:", coordinates);

//       // Extract latitude and longitude from coordinates
//       const { latitude, longitude } = coordinates;

//       // Format the coordinates as POINT(longitude latitude)
//       const location = `POINT(${longitude} ${latitude})`;

//       // Call your service's addBranch method to save the data
//       branchService
//         .addBranch(name, stateId, address, location, type, website, phone, isHQ)
//         .then((result) => {
//           console.log("Branch added with ID:", result);

//           // Send a response indicating success
//           res.status(201).json({ status: "success", branchId: result });
//         })
//         .catch((error) => {
//           console.log(error);
//           console.error("Error adding branch:", error.message);

//           // Send a response indicating an error
//           res
//             .status(500)
//             .json({ status: "error", message: "Error adding branch" });
//         });
//     })
//     .catch((error) => {
//       console.error("Error:", error.message);

//       // Send a response indicating an error
//       res
//         .status(500)
//         .json({ status: "error", message: "Error geocoding address" });
//     });
// });

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const branchId = req.params.id;
    console.log(branchId);
    if (!branchId) {
      return res
        .status(400)
        .json({ message: "Bad Request: branchId is missing" });
    } else {
      const result = await branchService.deleteBranch(branchId);

      res
        .status(204)
        .send({ status: "success", message: "deleted branch successful" });
    }
  } catch (error) {
    console.error("test", error.message);
    if (error.message === "Error: Branch not found") {
      res.status(404).send({ error: error.message });
    } else {
      res
        .status(500)
        .send({ error: "An error occurred while deleting branch" });
    }
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const branchId = req.params.id;

    if (!branchId) {
      return res
        .status(400)
        .json({ message: "Bad Request: branchId is missing" });
    }
    const {
      name,
      stateId,
      address,
      type,
      website,
      phone,
      isHQ,
      latitude,
      longitude,
    } = req.body;

    // Format the coordinates as POINT(longitude latitude)
    const location = `POINT(${longitude} ${latitude})`;
    await branchService.editBranch(
      branchId,
      name,
      stateId,
      address,
      location,
      type,
      website,
      phone,
      isHQ
    );

    res.status(200).json({
      status: "success",
      message: "Branch edited successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while editing branch" });
  }
});
module.exports = router;
