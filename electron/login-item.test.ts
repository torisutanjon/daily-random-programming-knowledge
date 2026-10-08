/** @jest-environment node */
import fs from "fs";
import path from "path";
import {
  LEGACY_LOGIN_ITEM_NAME,
  LOGIN_ITEM_NAME,
  legacyLoginItemRemoval,
  loginItemSettings,
} from "./login-item";

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

  it("the uninstaller deletes only when not updating", () => {
    const nsh = fs.readFileSync(
      path.join(__dirname, "assets", "installer.nsh"),
      "utf8",
    );
    const start = nsh.indexOf("${ifNot} ${isUpdated}");
    const end = nsh.indexOf("${endIf}");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const lines = nsh.match(/^.*DeleteRegValue.*$/gm) ?? [];
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const at = nsh.indexOf(line);
      expect(at).toBeGreaterThan(start);
      expect(at).toBeLessThan(end);
    }
  });

  it("the uninstaller removes the StartupApproved entries", () => {
    const nsh = fs.readFileSync(
      path.join(__dirname, "assets", "installer.nsh"),
      "utf8",
    );
    for (const name of [LOGIN_ITEM_NAME, LEGACY_LOGIN_ITEM_NAME]) {
      expect(nsh).toContain(
        `DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run" "${name}"`,
      );
    }
  });

  it("removes the legacy login item at runtime", () => {
    expect(legacyLoginItemRemoval()).toEqual({
      openAtLogin: false,
      name: "com.drpk.app",
    });
  });

  it("the legacy name is the AppUserModelId used in main.ts", () => {
    const main = fs.readFileSync(path.join(__dirname, "main.ts"), "utf8");
    expect(main).toContain(`const APP_ID = "${LEGACY_LOGIN_ITEM_NAME}"`);
  });
});
