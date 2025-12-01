import { Environment } from "uu5g05";
import Plus4U5 from "uu_plus4u5g02";

// NOTE During frontend development it's possible to redirect uuApp command calls elsewhere, e.g. to production/staging
// backend, by configuring it in *-hi/env/development.json:
//   "uu5Environment": {
//     "callsBaseUri": "https://uuapp-dev.plus4u.net/vnd-app/awid"
//   }

const Calls = {
  call(method, url, dtoIn, clientOptions) {
    return Plus4U5.Utils.AppClient[method](url, dtoIn, clientOptions);
  },

  // // example for mock calls
  // loadDemoContent(dtoIn) {
  //   const commandUri = Calls.getCommandUri("loadDemoContent");
  //   return Calls.call("cmdGet", commandUri, dtoIn);
  // },

  loadIdentityProfiles() {
    const commandUri = Calls.getCommandUri("sys/uuAppWorkspace/initUve");
    return Calls.call("cmdGet", commandUri);
  },

  initWorkspace(dtoInData) {
    const commandUri = Calls.getCommandUri("sys/uuAppWorkspace/init");
    return Calls.call("cmdPost", commandUri, dtoInData);
  },

  getWorkspace() {
    const commandUri = Calls.getCommandUri("sys/uuAppWorkspace/get");
    return Calls.call("cmdGet", commandUri);
  },

  async initAndGetWorkspace(dtoInData) {
    await Calls.initWorkspace(dtoInData);
    return await Calls.getWorkspace();
  },

  getCommandUri(useCase, baseUri = Environment.appBaseUri) {
    return (!baseUri.endsWith("/") ? baseUri + "/" : baseUri) + (useCase.startsWith("/") ? useCase.slice(1) : useCase);
  },
};

export default Calls;
