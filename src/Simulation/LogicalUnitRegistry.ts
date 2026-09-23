import Player from "../Components/Player";
import Team from "../Components/Team";
import type User from "../Components/User";
import Game from "../Game/Game";
import {
  LogicalUnitState,
  createLogicalUnitState,
  getLogicalGridCoordinate,
} from "./LogicalUnitState";

interface LogicalUnitEntry {
  state: LogicalUnitState;
  player?: Player;
}

export default class LogicalUnitRegistry {
  private units = new Map<string, LogicalUnitEntry>();
  private nextUnitId = 1;

  reset() {
    this.units.clear();
    this.nextUnitId = 1;
  }

  registerPlayer(player: Player, user?: User) {
    const existingId = player.logicalUnitId;
    if (existingId) {
      const existing = this.units.get(existingId);
      if (existing) {
        existing.player = player;
        this.syncStateFromPlayer(existing.state, player, user);
        return existing.state;
      }
    }

    const unitId = `unit-${this.nextUnitId++}`;
    const body = player.Body;
    const state = createLogicalUnitState({
      unitId,
      factionId: player.team.name,
      x: player.x,
      y: player.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      blockSize: Game.BlockSize,
      radius: Game.BlockSize / 2,
      speed: player.speed,
      userId: user?.id,
      role: player.role,
      rulerId: player.rulerId,
    });
    player.logicalUnitId = unitId;
    if (Game.Core?.logicalGameplayAuthority) {
      body.setVelocity(0, 0);
      body.moves = false;
    }
    this.units.set(unitId, { state, player });
    return state;
  }

  unregisterPlayer(player: Player | undefined) {
    const unitId = player?.logicalUnitId;
    if (!unitId) {
      return;
    }
    const entry = this.units.get(unitId);
    if (entry) {
      entry.state.alive = false;
    }
    this.units.delete(unitId);
    player.logicalUnitId = undefined;
  }

  unregisterUser(user: User | undefined) {
    if (!user) {
      return;
    }
    this.unregisterPlayer(user.player);
  }

  updateFaction(unitId: string | undefined, team: Team) {
    if (!unitId) {
      return;
    }
    const entry = this.units.get(unitId);
    if (entry) {
      entry.state.factionId = team.name;
    }
  }

  updateRole(unitId: string | undefined, role: "NORMAL" | "RULER", rulerId?: string) {
    if (!unitId) {
      return;
    }
    const entry = this.units.get(unitId);
    if (entry) {
      entry.state.role = role;
      entry.state.rulerId = rulerId;
    }
  }

  updateSpeed(unitId: string | undefined, speed: number) {
    if (!unitId) {
      return;
    }
    const entry = this.units.get(unitId);
    if (!entry) {
      return;
    }
    entry.state.speed = speed;
    const length = Math.hypot(entry.state.logicalVX, entry.state.logicalVY) || 1;
    entry.state.logicalVX = (entry.state.logicalVX / length) * speed;
    entry.state.logicalVY = (entry.state.logicalVY / length) * speed;
  }

  teleportPlayer(player: Player, x: number, y: number) {
    const entry = player.logicalUnitId ? this.units.get(player.logicalUnitId) : undefined;
    if (!entry) {
      return;
    }
    entry.state.logicalX = x;
    entry.state.logicalY = y;
    const grid = getLogicalGridCoordinate(x, y, Game.BlockSize);
    entry.state.currentGridX = grid.gridX;
    entry.state.currentGridY = grid.gridY;
    this.syncPlayer(player, entry.state);
  }

  get(unitId: string) {
    return this.units.get(unitId)?.state;
  }

  getAliveUnits() {
    return [...this.units.values()]
      .map((entry) => entry.state)
      .filter((unit) => unit.alive);
  }

  getEntries() {
    return [...this.units.values()];
  }

  exportState() {
    return { nextUnitSequence: this.nextUnitId };
  }

  syncVisuals() {
    this.units.forEach((entry) => {
      if (entry.player?.active && entry.state.alive) {
        this.syncPlayer(entry.player, entry.state);
      }
    });
  }

  private syncPlayer(player: Player, state: LogicalUnitState) {
    player.setPosition(state.logicalX, state.logicalY);
    if (Game.Core?.logicalGameplayAuthority) {
      player.Body.setVelocity(0, 0);
      player.Body.moves = false;
    }
  }

  private syncStateFromPlayer(state: LogicalUnitState, player: Player, user?: User) {
    state.factionId = player.team.name;
    state.logicalX = player.x;
    state.logicalY = player.y;
    state.speed = player.speed;
    state.userId = user?.id;
    state.role = player.role;
    state.rulerId = player.rulerId;
    const grid = getLogicalGridCoordinate(player.x, player.y, Game.BlockSize);
    state.currentGridX = grid.gridX;
    state.currentGridY = grid.gridY;
  }
}
