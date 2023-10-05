const db = require("../db/db");

class StateService {
  // Get all states
  static async getAllStates() {
    try {
      const [states] = await db.query("SELECT * FROM states");
      return states;
    } catch (error) {
      throw new Error("Error fetching states");
    }
  }

  // Find a state by ID
  static async findById(stateId) {
    // Validate stateId to ensure it's a positive integer
    if (!Number.isInteger(stateId) || stateId <= 0) {
      throw new Error("Invalid state ID");
    }

    try {
      const [state] = await db.query("SELECT * FROM states WHERE id = ?", [
        stateId,
      ]);
      return state[0] || null; // Return the first result or null if not found
    } catch (error) {
      throw new Error("Error finding state by ID");
    }
  }

  // Add a new state
  static async addState(stateName) {
    try {
      const result = await db.query(
        "INSERT INTO states (state_name) VALUES (?)",
        [stateName]
      );
      return result.insertId;
    } catch (error) {
      throw new Error("Error adding state");
    }
  }

  // Edit a state's name
  static async editStateName(stateId, newName) {
    try {
      await db.query("UPDATE states SET state_name = ? WHERE id = ?", [
        newName,
        stateId,
      ]);
    } catch (error) {
      throw new Error("Error updating state name");
    }
  }

  // Delete a state
  static async deleteState(stateId) {
    try {
      await db.query("DELETE FROM states WHERE id = ?", [stateId]);
    } catch (error) {
      throw new Error("Error deleting state");
    }
  }
}

module.exports = StateService;
