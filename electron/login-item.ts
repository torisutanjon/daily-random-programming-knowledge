export const LOGIN_ITEM_NAME = "drpk";

export function loginItemSettings(on: boolean): {
  openAtLogin: boolean;
  args: string[];
  name: string;
} {
  return { openAtLogin: on, args: ["--hidden"], name: LOGIN_ITEM_NAME };
}

export const LEGACY_LOGIN_ITEM_NAME = "com.drpk.app";

export function legacyLoginItemRemoval(): { openAtLogin: false; name: string } {
  return { openAtLogin: false, name: LEGACY_LOGIN_ITEM_NAME };
}
