import { Test, VisualComponent } from "uu5g05-test";
import Tile from "../../../src/bricks/rocket/tile.js";

function getDefaultProps() {
  return {
    children: "Test content",
  };
}

async function setup(props = {}, opts) {
  return VisualComponent.setup(Tile, { ...getDefaultProps(), ...props }, opts);
}

describe("UuRocket.Bricks.Rocket.Tile", () => {
  VisualComponent.testProperties(setup);

  it("checks default property values", async () => {
    await setup();

    expect(Test.screen.getByText("Test content")).toBeInTheDocument();
  });
});
