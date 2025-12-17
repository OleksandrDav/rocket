import { createVisualComponent, Utils } from "uu5g05";
import Config from "../../routes/config/config.js"; // Adjust path to your config

const Css = {
  header: () => Config.Css.css({ textAlign: "center", marginBottom: 48 }),
  title: () =>
    Config.Css.css({
      fontSize: 42,
      fontWeight: "800",
      background: "-webkit-linear-gradient(45deg, #FF512F, #DD2476)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      marginBottom: 16,
    }),
  subtitle: () => Config.Css.css({ fontSize: 18, color: "#666", maxWidth: 600, margin: "0 auto" }),
};

const Header = createVisualComponent({
  uu5Tag: Config.TAG + "Header",

  render(props) {
    const attrs = Utils.VisualComponent.getAttrs(props);
    return (
      <header {...attrs} className={Css.header()}>
        <h1 className={Css.title()}>Rocket Explorer</h1>
        <p className={Css.subtitle()}>Server-Side Rendered Data • Client-Side Interactive Hydration</p>
      </header>
    );
  },
});

export default Header;
