//@@viewOn:imports
import { createVisualComponent, Lsi, useRoute } from "uu5g05";
import Plus4U5App from "uu_plus4u5g02-app";

import Config from "./config/config.js";
import importLsi from "../lsi/import-lsi.js";
//@@viewOff:imports

//@@viewOn:constants
//@@viewOff:constants

//@@viewOn:css
//@@viewOff:css

//@@viewOn:helpers
//@@viewOff:helpers

const RouteBar = createVisualComponent({
  //@@viewOn:statics
  uu5Tag: Config.TAG + "RouteBar",
  //@@viewOff:statics

  //@@viewOn:propTypes
  propTypes: {
    ...Plus4U5App.PositionBar.propTypes,
  },
  //@@viewOff:propTypes

  //@@viewOn:defaultProps
  defaultProps: {},
  //@@viewOff:defaultProps

  render(props) {
    //@@viewOn:private
    // 1. Get the control function from the hook
    const [, setRoute] = useRoute();

    // 2. CREATE THE BRIDGE 
    // We expose this internal function to the global window object.
    // This allows our Node.js Server (Middleware) to "remote control" the app.
    if (typeof window !== "undefined") {
      window.__SSR_SET_ROUTE__ = (routeName) => {
        // console.log("[App] SSR Bridge: Switching route to", routeName);
        setRoute(routeName);
      };
    }

    const actionList = [
      {
        children: <Lsi import={importLsi} path={["Menu", "home"]} />,
        onClick: () => setRoute("home"),
      },
      {
        children: <Lsi import={importLsi} path={["Menu", "contact"]} />,
        onClick: () => setRoute("contact"),
      },
    ];
    //@@viewOff:private

    //@@viewOn:render
    return <Plus4U5App.PositionBar actionList={actionList} {...props} />;
    //@@viewOff:render
  },
});

//@@viewOn:exports
export { RouteBar };
export default RouteBar;
//@@viewOff:exports
