import { WORLD_MONTH_MS } from "../config/simulation";
import { store } from "../store";
import { setWorldMonth } from "../store/rootSlice";
import { getWorldYear } from "./WorldTime";

export default class WorldClock {
  worldMonth = 0;
  private elapsed = 0;
  private running = false;

  reset() {
    this.worldMonth = 0;
    this.elapsed = 0;
    this.publish();
  }

  setRunning(running: boolean) {
    this.running = running;
  }

  update(delta: number) {
    if (!this.running) {
      return 0;
    }

    this.elapsed += delta;
    let advancedMonths = 0;
    while (this.elapsed >= WORLD_MONTH_MS) {
      this.elapsed -= WORLD_MONTH_MS;
      this.worldMonth += 1;
      advancedMonths += 1;
      this.publish();
    }
    return advancedMonths;
  }

  get year() {
    return this.worldMonth;
  }

  exportState() {
    return { worldMonth: this.worldMonth, elapsedMs: this.elapsed, running: this.running };
  }

  importState(state: { worldMonth: number; elapsedMs: number; running: boolean }) {
    this.worldMonth = state.worldMonth;
    this.elapsed = state.elapsedMs;
    this.running = state.running;
    this.publish();
  }

  private publish() {
    store.dispatch(
      setWorldMonth({
        monthIndex: this.worldMonth,
        year: getWorldYear(this.worldMonth),
      })
    );
  }
}
