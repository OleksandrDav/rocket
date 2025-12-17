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

  async get(awid, id) {
    return await super.findOne({ awid, id });
  }

  async delete(awid, id) {
    return await super.deleteOne({ awid, id });
  }
}

module.exports = RocketMongo;
