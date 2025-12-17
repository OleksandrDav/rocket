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

const Delete = {
  UC_CODE: `${RocketMainUseCaseError.ERROR_PREFIX}rocket/delete/`,

  InvalidDtoIn: class extends RocketMainUseCaseError {
    constructor() {
      super(...arguments);
      this.code = `${Delete.UC_CODE}invalidDtoIn`;
      this.message = "DtoIn is not valid.";
    }
  },

  RocketDoesNotExist: class extends RocketMainUseCaseError {
    constructor() {
      super(...arguments);
      this.code = `${Delete.UC_CODE}rocketDoesNotExist`;
      this.message = "Rocket with given id does not exist.";
      this.status = 404;
    }
  },
};

module.exports = {
  Create,
  List,
  Delete,
};
