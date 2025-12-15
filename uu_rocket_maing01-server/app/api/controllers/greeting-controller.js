"use strict";
class GreetingController {
  helloWorld(ucEnv) {
    const dtoOut = {
      ucEnv: ucEnv.getUri(),
      session: ucEnv.getSession(), 
      text: "Hello World!",
      uuAppErrorMap: {},
    };

    return dtoOut;
  }
}

module.exports = new GreetingController();