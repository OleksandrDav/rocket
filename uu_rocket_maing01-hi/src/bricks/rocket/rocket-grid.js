import { createVisualComponent, Utils } from "uu5g05";
import Config from "../../routes/config/config.js";
import RocketCard from "./rocket-card.js";

const Css = {
  grid: () =>
    Config.Css.css({
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      gap: 32,
    }),
  emptyState: () => Config.Css.css({ gridColumn: "1/-1", textAlign: "center", color: "#888", padding: 40 }),
};

const RocketGrid = createVisualComponent({
  uu5Tag: Config.TAG + "RocketGrid",

  render({ items, ...props }) {
    const attrs = Utils.VisualComponent.getAttrs(props);

    if (items.length === 0) {
      return (
        <div {...attrs} className={Css.emptyState()}>
          No rockets match your search coordinates.
        </div>
      );
    }

    return (
      <div {...attrs} className={Css.grid()}>
        {items.map((item) => (
          <RocketCard key={item.id} item={item} />
        ))}
      </div>
    );
  },
});

export default RocketGrid;
