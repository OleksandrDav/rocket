import { createVisualComponent, Utils } from "uu5g05";
import Config from "../../routes/config/config.js";

const Css = {
  controls: () => Config.Css.css({ display: "flex", justifyContent: "center", marginBottom: 32 }),
  searchInput: () =>
    Config.Css.css({
      padding: "12px 20px",
      fontSize: 16,
      border: "2px solid #eee",
      borderRadius: 30,
      width: 300,
      outline: "none",
      transition: "border-color 0.3s",
      ":focus": { borderColor: "#DD2476" },
    }),
};

const SearchControls = createVisualComponent({
  uu5Tag: Config.TAG + "SearchControls",

  render({ value, onChange, ...props }) {
    const attrs = Utils.VisualComponent.getAttrs(props);
    return (
      <div {...attrs} className={Css.controls()}>
        <input
          type="text"
          placeholder="🔍 Filter rockets..."
          className={Css.searchInput()}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  },
});

export default SearchControls;
