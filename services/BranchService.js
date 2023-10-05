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

  async addBranch(name, stateId, address, location, type, isHQ) {
    try {
      const branchId = await this.branchModel.addBranch(
        name,
        stateId,
        address,
        location,
        type,
        isHQ
      );
      return branchId;
    } catch (error) {
      console.log(error);
      throw new Error("Error adding branches");
    }
  }
}

module.exports = BranchService;
