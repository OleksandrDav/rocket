"use strict";
const RocketMainAbl = require("../../abl/rocket-main-abl.js");

class RocketMainController {
  init(ucEnv) {
    return RocketMainAbl.init(ucEnv.getUri(), ucEnv.getDtoIn(), ucEnv.getSession());
  }

  load(ucEnv) {
    return RocketMainAbl.load(ucEnv.getUri(), ucEnv.getSession());
  }

  loadBasicData(ucEnv) {
    return RocketMainAbl.loadBasicData(ucEnv.getUri(), ucEnv.getSession());
  }
}

module.exports = new RocketMainController();
