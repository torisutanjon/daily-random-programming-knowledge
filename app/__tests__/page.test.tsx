import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the app name as the main heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "drpk" }),
    ).toBeInTheDocument();
  });
});
