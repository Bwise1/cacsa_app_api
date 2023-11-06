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
    // if (!Number.isInteger(branchId) || branchId <= 0) {
    //   throw new Error("Invalid branch ID");
    // }
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
  static async addBranch(
    name,
    stateId,
    address,
    location,
    type,
    website,
    phone,
    isHQ
  ) {
    console.log({ stateId: stateId });
    try {
      const result = await db.query(
        "INSERT INTO branches (name, state_id, address, location, type, website, phone, is_HQ) VALUES (?, ?, ?, ST_GeomFromText(?), ?, ?, ?, CASE WHEN ? THEN 1 ELSE 0 END)",
        [name, stateId, address, location, type, website, phone, isHQ]
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
    stateId,
    address,
    location,
    type,
    website,
    phone,
    isHQ
  ) {
    try {
      await db.query(
        "UPDATE branches SET name = ?, address = ?, state_id = ?, type = ?, website = ?, phone = ?, is_HQ = ?, location = ST_GeomFromText(?) WHERE id = ?",
        [name, address, stateId, type, website, phone, isHQ, location, branchId]
      );
    } catch (error) {
      console.error(error);
      throw new Error("Error updating branch");
    }
  }

  // Delete a branch
  static async deleteBranch(branchId) {
    try {
      const result = await db.query("DELETE FROM branches WHERE id = ?", [
        branchId,
      ]);
      return result.affectedRows;
    } catch (error) {
      throw new Error("Error deleting branch");
    }
  }

  static async getBranchesByType(type) {
    const query = `
      SELECT
          b.id AS branch_id,
          b.name AS branch_name,
          s.state_name,
          b.address,
          b.location,
          b.type,
          b.website,
          b.phone,
          b.is_HQ
      FROM
          branches AS b
      JOIN
          states AS s ON b.state_id = s.id
      WHERE
          b.type = ?
      ORDER BY
          b.type, s.state_name, b.name;
    `;

    try {
      const [results] = await db.query(query, [type]);
      return results;
    } catch (error) {
      throw new Error(`Error fetching branches: ${error.message}`);
    }
  }
}

module.exports = Branch;
