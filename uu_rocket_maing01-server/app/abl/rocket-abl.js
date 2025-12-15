"use strict";
const { Validator } = require("uu_appg01_server").Validation;
const { ValidationHelper } = require("uu_appg01_server").AppServer;
const { DaoFactory } = require("uu_appg01_server").ObjectStore;

const Errors = require("../api/errors/rocket-error.js");
const Warnings = require("../api/warnings/rocket-warning.js");

const FISHY_WORDS = ["barracuda", "broccoli", "Topolánek"];

class RocketAbl {
  constructor() {
    this.validator = Validator.load();
    this.dao = DaoFactory.getDao("rocket");
  }

  async create(awid, dtoIn) {
    let uuAppErrorMap = {};

    // validation of dtoIn
    const validationResult = this.validator.validate("rocketCreateDtoInType", dtoIn);
    uuAppErrorMap = ValidationHelper.processValidationResult(
      dtoIn,
      validationResult,
      uuAppErrorMap,
      Warnings.Create.UnsupportedKeys.code,
      Errors.Create.InvalidDtoIn,
    );

    // check for fishy words
    FISHY_WORDS.forEach((word) => {
      if (dtoIn.text.includes(word)) {
        throw new Errors.Create.TextContainsFishyWords({ uuAppErrorMap }, { text: dtoIn.text, fishyWord: word });
      }
    });

    // save rocket to uuObjectStore
    dtoIn.awid = awid;
    const rocket = await this.dao.create(dtoIn);

    // prepare and return dtoOut
    const dtoOut = { ...rocket, uuAppErrorMap };
    return dtoOut;
  }
  async list(awid, dtoIn) {
    let uuAppErrorMap = {};

    // validates dtoIn
    const validationResult = this.validator.validate("rocketListDtoInType", dtoIn);
    uuAppErrorMap = ValidationHelper.processValidationResult(
      dtoIn,
      validationResult,
      uuAppErrorMap,
      Warnings.List.UnsupportedKeys.code,
      Errors.List.InvalidDtoIn,
    );

    // set default value for the pageInfo
    if (!dtoIn.pageInfo) dtoIn.pageInfo = {};
    dtoIn.pageInfo.pageSize ??= 100;
    dtoIn.pageInfo.pageIndex ??= 0;

    // fetch list
    const dtoOut = await this.dao.list(awid, dtoIn.pageInfo);

    // prepare and return dtoOut
    dtoOut.uuAppErrorMap = uuAppErrorMap;
    return dtoOut;
  }
}

module.exports = new RocketAbl();
