import "./style.css"
import { mountApp } from "./app"

if (import.meta.env.VITE_CASCADE_SMOKE === "1") {
  void import("./smoke").then(smoke => {
    const app = mountApp(smoke.fixtureProvider)
    void smoke.runFixtureSmoke(app)
  })
} else {
  mountApp()
}
