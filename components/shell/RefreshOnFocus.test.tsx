import { fireEvent, render } from "@testing-library/react";
import RefreshOnFocus from "@/components/shell/RefreshOnFocus";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("RefreshOnFocus", () => {
  beforeEach(() => refresh.mockClear());

  it("refreshes on window focus and stops after unmount", () => {
    const { unmount } = render(<RefreshOnFocus />);
    fireEvent.focus(window);
    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.focus(window);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
