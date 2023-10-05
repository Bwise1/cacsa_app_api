const db = require("../db/db");

class Branch {
  // Get all branches
  static async getAllBranches() {
    try {
      const [branches] = await db.query("SELECT * FROM branches");
      return branches;
    } catch (error) {
      throw new Error("Error fetching branches");
    }
  }

  //find a branch
  static async findById(branchId) {
    // Validate branchId to ensure it's a positive integer
    if (!Number.isInteger(branchId) || branchId <= 0) {
      throw new Error("Invalid branch ID");
    }
    try {
      const [branch] = await db.query("SELECT * FROM branches WHERE id = ?", [
        branchId,
      ]);
      return branch[0] || null; // Return the first result or null if not found
    } catch (error) {
      throw new Error("Error finding branch by ID");
    }
  }

  // Add a new branch
  static async addBranch(name, stateId, address, location, type, isHQ) {
    console.log({ stateId: stateId });
    try {
      const result = await db.query(
        "INSERT INTO branches (name, state_id, address, location, type, is_HQ) VALUES (?, ?, ?, ST_GeomFromText(?), ?, ?)",
        [name, stateId, address, location, type, isHQ]
      );
      return result.insertId;
    } catch (error) {
      console.log("error from model", error);
      throw new Error("Error adding branch");
    }
  }

  // Edit a branch's information
  static async editBranch(
    branchId,
    name,
    address,
    stateId,
    type,
    isHQ,
    location
  ) {
    try {
      await db.query(
        "UPDATE branches SET name = ?, address = ?, state_id = ?, type = ?, is_HQ = ?, location = ? WHERE id = ?",
        [name, address, stateId, type, isHQ, location, branchId]
      );
    } catch (error) {
      throw new Error("Error updating branch");
    }
  }

  // Delete a branch
  static async deleteBranch(branchId) {
    try {
      await db.query("DELETE FROM branches WHERE id = ?", [branchId]);
    } catch (error) {
      throw new Error("Error deleting branch");
    }
  }
}

module.exports = Branch;
