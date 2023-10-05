const express = require("express");
const StateService = require("../services/StateService");
const StatesModel = require("../models/StatesModel");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();
const stateService = new StateService(StatesModel); // Create an instance of StateService

router.get("/", async (req, res) => {
  try {
    const states = await stateService.getAllStates();
    res.status(200).json({ status: "success", states: states });
  } catch (error) {
    console.error("Error fetching states:", error);
    res.status(500).send({ error: "An error occurred while fetching states." });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  const { stateName } = req.body;

  try {
    const stateId = await stateService.addState(stateName);
    res.status(201).json({ status: "success", stateId: stateId });
  } catch (error) {
    console.error("Error adding state:", error);
    res
      .status(500)
      .send({ error: "An error occurred while adding a new state." });
  }
});

router.put("/:stateId", async (req, res) => {
  const stateId = req.params.stateId;
  const { newStateName } = req.body;

  try {
    await stateService.editStateName(stateId, newStateName);
    res.status(200).json({ status: "success", message: "State name updated." });
  } catch (error) {
    console.error("Error updating state name:", error);
    res
      .status(500)
      .send({ error: "An error occurred while updating the state name." });
  }
});

router.delete("/:stateId", async (req, res) => {
  const stateId = req.params.stateId;

  try {
    await stateService.deleteState(stateId);
    res.status(204).json({ status: "success", message: "state deleted" });
  } catch (error) {
    console.error("Error deleting state:", error);
    res
      .status(500)
      .send({ error: "An error occurred while deleting the state." });
  }
});

module.exports = router;
