class BranchService {
  constructor(BranchModel) {
    // Initialize the service with the required model
    this.branchModel = BranchModel;
  }

  async getAllBranches() {
    try {
      const branches = await this.branchModel.getAllBranches();
      return branches;
    } catch (error) {
      throw new Error("Error fetching branches");
    }
  }

  async addBranch(
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
      const branchId = await this.branchModel.addBranch(
        name,
        stateId,
        address,
        location,
        type,
        website,
        phone,
        isHQ
      );
      return branchId;
    } catch (error) {
      console.log(error);
      throw new Error("Error adding branches");
    }
  }

  async getHigherInstitutionBranches() {
    try {
      const type = "Higher Institution"; // Set the type you want to filter
      const branches = await this.branchModel.getBranchesByType(type);
      return branches;
    } catch (error) {
      throw new Error(
        `Error fetching Higher Institution branches: ${error.message}`
      );
    }
  }

  async getStateBranches() {
    try {
      const type = "State Branch"; // Set the type you want to filter
      const branches = await this.branchModel.getBranchesByType(type);
      return branches;
    } catch (error) {
      throw new Error(`Error fetching State branches: ${error.message}`);
    }
  }

  async deleteBranch(branchId) {
    try {
      const branch = await this.branchModel.findById(branchId);
      console.log(branch);
      if (!branch) {
        throw new Error("Branch not found");
      } else {
        const result = await this.branchModel.deleteBranch(branchId);
        console.log("result:", result);
        return result;
      }
    } catch (error) {
      throw new Error(error);
    }
  }
}

module.exports = BranchService;
