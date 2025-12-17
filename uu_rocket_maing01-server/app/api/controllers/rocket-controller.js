"use strict";
const RocketAbl = require("../../abl/rocket-abl.js");

class RocketController {
  create(ucEnv) {
    return RocketAbl.create(
      ucEnv.getUri().getAwid(),
      ucEnv.getDtoIn(),
      ucEnv.getSession(),
      ucEnv.getAuthorizationResult(),
    );
  }

  list(ucEnv) {
    return RocketAbl.list(ucEnv.getUri().getAwid(), ucEnv.getDtoIn());
  }

  delete(ucEnv) {
    return RocketAbl.delete(ucEnv.getUri().getAwid(), ucEnv.getDtoIn());
  }
}

module.exports = new RocketController();
