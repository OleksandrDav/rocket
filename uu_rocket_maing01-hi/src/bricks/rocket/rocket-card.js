import { createVisualComponent, Utils, useState } from "uu5g05";
import Config from "../../routes/config/config.js";

const Css = {
  card: () =>
    Config.Css.css({
      background: "white",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 10px 40px -10px rgba(0,0,0,0.1)",
      transition: "transform 0.2s, box-shadow 0.2s",
      display: "flex",
      flexDirection: "column",
      ":hover": { transform: "translateY(-5px)", boxShadow: "0 20px 50px -10px rgba(0,0,0,0.15)" },
    }),
  cardImage: () => Config.Css.css({ width: "100%", height: 200, objectFit: "cover", backgroundColor: "#f0f0f0" }),
  cardContent: () => Config.Css.css({ padding: 24, flexGrow: 1, display: "flex", flexDirection: "column" }),
  cardHeader: () =>
    Config.Css.css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }),
  rocketName: () => Config.Css.css({ fontSize: 20, fontWeight: "bold", margin: 0 }),
  badge: (active) =>
    Config.Css.css({
      fontSize: 12,
      fontWeight: "bold",
      padding: "4px 12px",
      borderRadius: 20,
      textTransform: "uppercase",
      backgroundColor: active ? "#e6fffa" : "#f7fafc",
      color: active ? "#2c7a7b" : "#718096",
      border: `1px solid ${active ? "#b2f5ea" : "#edf2f7"}`,
    }),
  description: () => Config.Css.css({ fontSize: 14, lineHeight: 1.6, color: "#555", marginBottom: 20, flexGrow: 1 }),
  metaRow: () =>
    Config.Css.css({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: 14,
      color: "#888",
      marginTop: "auto",
      paddingTop: 16,
      borderTop: "1px solid #eee",
    }),
};

const RocketCard = createVisualComponent({
  uu5Tag: Config.TAG + "RocketCard",

  render({ item, ...props }) {
    const attrs = Utils.VisualComponent.getAttrs(props);

    const imgSrc = item.imageUrl || "https://placehold.co/600x400/orange/white?text=Rocket";
    const dateStr = item.firstFlightDate ? new Date(item.firstFlightDate).toLocaleDateString() : "Unknown";

    return (
      <div {...attrs} className={Css.card()}>
        <img src={imgSrc} alt={item.name} className={Css.cardImage()} loading="lazy" />

        <div className={Css.cardContent()}>
          <div className={Css.cardHeader()}>
            <h3 className={Css.rocketName()}>{item.name}</h3>
            <span className={Css.badge(item.active)}>{item.active ? "Active" : "Retired"}</span>
          </div>

          <p className={Css.description()}>{item.text}</p>

          <div className={Css.metaRow()}>
            <span>📅 {dateStr}</span>
            <span>⭐ {item.rating ?? "N/A"}/10</span>
          </div>
        </div>
      </div>
    );
  },
});

export default RocketCard;
