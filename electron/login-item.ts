export const LOGIN_ITEM_NAME = "drpk";

export function loginItemSettings(on: boolean): {
  openAtLogin: boolean;
  args: string[];
  name: string;
} {
  return { openAtLogin: on, args: ["--hidden"], name: LOGIN_ITEM_NAME };
}
