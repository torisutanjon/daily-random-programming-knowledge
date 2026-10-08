/** @jest-environment node */
import fs from "fs";
import path from "path";
import { LOGIN_ITEM_NAME, loginItemSettings } from "./login-item";

describe("login item", () => {
  it("names the login item drpk", () => {
    expect(LOGIN_ITEM_NAME).toBe("drpk");
  });

  it("turning on registers a hidden start under that name", () => {
    expect(loginItemSettings(true)).toEqual({
      openAtLogin: true,
      args: ["--hidden"],
      name: "drpk",
    });
  });

  it("turning off uses the same name", () => {
    expect(loginItemSettings(false)).toEqual({
      openAtLogin: false,
      args: ["--hidden"],
      name: "drpk",
    });
  });

  it("the uninstaller removes that Run value", () => {
    const nsh = fs.readFileSync(
      path.join(__dirname, "assets", "installer.nsh"),
      "utf8",
    );
    expect(nsh).toContain("!macro customUnInstall");
    expect(nsh).toContain(
      `DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "${LOGIN_ITEM_NAME}"`,
    );
  });

  it("the uninstaller also removes the legacy AppUserModelId value", () => {
    const nsh = fs.readFileSync(
      path.join(__dirname, "assets", "installer.nsh"),
      "utf8",
    );
    expect(nsh).toContain(
      `DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "com.drpk.app"`,
    );
  });
});
