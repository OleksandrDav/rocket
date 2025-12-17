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
    // This gets the RocketMongo DAO instance
    this.dao = DaoFactory.getDao("rocket");
  }

  async create(awid, dtoIn) {
    let uuAppErrorMap = {};

    // 1. Validation of dtoIn
    const validationResult = this.validator.validate("rocketCreateDtoInType", dtoIn);
    uuAppErrorMap = ValidationHelper.processValidationResult(
      dtoIn,
      validationResult,
      uuAppErrorMap,
      Warnings.Create.UnsupportedKeys.code,
      Errors.Create.InvalidDtoIn,
    );

    // 2. Check for fishy words
    FISHY_WORDS.forEach((word) => {
      if (dtoIn.text.includes(word) || dtoIn.name.includes(word)) {
        throw new Errors.Create.TextContainsFishyWords({ uuAppErrorMap }, { text: dtoIn.text, fishyWord: word });
      }
    });

    // 3. Set Defaults
    // New fields defaulting logic
    if (dtoIn.rating === undefined) dtoIn.rating = null;
    if (dtoIn.active === undefined) dtoIn.active = true;

    // 4. Save rocket
    dtoIn.awid = awid;
    // Optional: Add system metadata (created timestamp)
    dtoIn.sys = { cts: new Date().toISOString(), rev: 0 };

    const rocket = await this.dao.create(dtoIn);

    const dtoOut = { ...rocket, uuAppErrorMap };
    return dtoOut;
  }

  async list(awid, dtoIn) {
    let uuAppErrorMap = {};

    const validationResult = this.validator.validate("rocketListDtoInType", dtoIn);
    uuAppErrorMap = ValidationHelper.processValidationResult(
      dtoIn,
      validationResult,
      uuAppErrorMap,
      Warnings.List.UnsupportedKeys.code,
      Errors.List.InvalidDtoIn,
    );

    if (!dtoIn.pageInfo) dtoIn.pageInfo = {};
    dtoIn.pageInfo.pageSize ??= 100;
    dtoIn.pageInfo.pageIndex ??= 0;

    const dtoOut = await this.dao.list(awid, dtoIn.pageInfo);

    dtoOut.uuAppErrorMap = uuAppErrorMap;
    return dtoOut;
  }

  // --- NEW DELETE METHOD ---
  async delete(awid, dtoIn) {
    let uuAppErrorMap = {};

    // 1. Validation
    const validationResult = this.validator.validate("rocketDeleteDtoInType", dtoIn);
    uuAppErrorMap = ValidationHelper.processValidationResult(
      dtoIn,
      validationResult,
      uuAppErrorMap,
      Warnings.Delete.UnsupportedKeys.code,
      Errors.Delete.InvalidDtoIn,
    );

    // 2. Check Existence
    // We use the new DAO.get() method here
    const rocket = await this.dao.get(awid, dtoIn.id);
    if (!rocket) {
      throw new Errors.Delete.RocketDoesNotExist({ uuAppErrorMap }, { id: dtoIn.id });
    }

    // 3. Delete
    // We use the new DAO.delete() method here
    await this.dao.delete(awid, dtoIn.id);

    // 4. Return success
    return { uuAppErrorMap };
  }
}

module.exports = new RocketAbl();
