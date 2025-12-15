"use strict";
const RocketMainUseCaseError = require("./rocket-main-use-case-error.js");

const Create = {
  UC_CODE: `${RocketMainUseCaseError.ERROR_PREFIX}rocket/create/`,

  InvalidDtoIn: class extends RocketMainUseCaseError {
    constructor() {
      super(...arguments);
      this.code = `${Create.UC_CODE}invalidDtoIn`;
      this.message = "DtoIn is not valid.";
    }
  },

  TextContainsFishyWords: class extends RocketMainUseCaseError {
    constructor() {
      super(...arguments);
      this.code = `${Create.UC_CODE}textContainsFishyWords`;
      this.message = "The text of the rocket contains fishy words.";
    }
  },
};

const List = {
  UC_CODE: `${RocketMainUseCaseError.ERROR_PREFIX}rocket/list/`,

  InvalidDtoIn: class extends RocketMainUseCaseError {
    constructor() {
      super(...arguments);
      this.code = `${List.UC_CODE}invalidDtoIn`;
      this.message = "DtoIn is not valid.";
    }
  },
};

module.exports = {
  Create,
  List,
};
