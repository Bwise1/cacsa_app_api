class StateService {
  constructor(StatesModel) {
    // Initialize the service with the required model
    this.statesModel = StatesModel;
  }

  async getAllStates() {
    try {
      const states = await this.statesModel.getAllStates();
      return states;
    } catch (error) {
      throw new Error("Error fetching states");
    }
  }

  async addState(stateName) {
    try {
      const stateId = await this.statesModel.addState(stateName);
      return stateId;
    } catch (error) {
      throw new Error("Error adding state");
    }
  }

  async editStateName(stateId, newStateName) {
    try {
      await this.statesModel.editStateName(stateId, newStateName);
    } catch (error) {
      throw new Error("Error updating state name");
    }
  }

  async deleteState(stateId) {
    try {
      await this.statesModel.deleteState(stateId);
    } catch (error) {
      throw new Error("Error deleting state");
    }
  }
}

module.exports = StateService;
