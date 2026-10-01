// Pin one DST-observing zone for every test run so date tests are deterministic on any machine.
// It must be set here: workers inherit it, whereas process.env inside a test file is a sandboxed copy.
export default function globalSetup(): void {
  process.env.TZ = "America/New_York";
}
