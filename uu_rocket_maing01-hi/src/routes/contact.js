//@@viewOn:imports
import { createVisualComponent } from "uu5g05";

import Config from "./config/config.js";
//@@viewOff:imports

//@@viewOn:constants
//@@viewOff:constants

//@@viewOn:css
const Css = {
  icon: () =>
    Config.Css.css({
      fontSize: 48,
      lineHeight: "1em",
    }),
};
//@@viewOff:css

//@@viewOn:helpers
//@@viewOff:helpers

let Contact = createVisualComponent({
  //@@viewOn:statics
  uu5Tag: Config.TAG + "Contact",
  //@@viewOff:statics

  //@@viewOn:propTypes
  propTypes: {},
  //@@viewOff:propTypes

  //@@viewOn:defaultProps
  defaultProps: {},
  //@@viewOff:defaultProps

  render(props) {
    //@@viewOn:private
    //@@viewOff:private

    //@@viewOn:render
    return (
      <div>
        <h1>My contacts:</h1>
        <div>
          <b>+420 774 675 607</b>
        </div>
      </div>
    );
    //@@viewOff:render
  },
});

//@@viewOn:exports
export { Contact };
export default Contact;
//@@viewOff:exports
