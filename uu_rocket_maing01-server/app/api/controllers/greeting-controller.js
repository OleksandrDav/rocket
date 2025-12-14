"use strict";
class GreetingController {
  helloWorld(ucEnv) {
    const dtoOut = {
      text: "Hello World!",
      uuAppErrorMap: {},
    };

    return dtoOut;
  }
}

module.exports = new GreetingController();