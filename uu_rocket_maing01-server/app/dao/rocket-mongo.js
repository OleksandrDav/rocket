const { UuObjectDao } = require("uu_appg01_server").ObjectStore;

class RocketMongo extends UuObjectDao {
  async createSchema() {}

  async create(rocket) {
    return await super.insertOne(rocket);
  }

  async list(awid, pageInfo = {}) {
    const filter = { awid };

    return await super.find(filter, pageInfo);
  }
}

module.exports = RocketMongo;