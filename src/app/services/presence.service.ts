import { Injectable, NgZone, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { SupabaseClientService } from "./supabase-client.service";
import { AuthService } from "./auth.service";
import { UserTab } from "../core/interfaces";

type ActiveTabLease = {
  tabId: string;
  ts: number;
  leaseMs: number;
};

@Injectable({ providedIn: "root" })
export class PresenceService implements OnDestroy {
  public deviceId: string;
  public tabId: string;

  private userSub: Subscription;
  private currentUserId: string | null = null;

  private readonly ACTIVE_HEARTBEAT_MS = 5000;
  private readonly BACKGROUND_HEARTBEAT_MS = 30000;

  private readonly ACTIVE_LEASE_MS = 15000;
  private leaseKey!: string;

  private heartbeatTimer: any = null;

  private hasFocus = document.hasFocus();
  private visibility = document.visibilityState;
  private lastSentAt = 0;

  private readonly onVisibilityChange = () => {
    this.visibility = document.visibilityState;
    this.onLocalActivityChange("visibilitychange");
  };

  private readonly onFocus = () => {
    this.hasFocus = true;
    this.onLocalActivityChange("focus");
  };

  private readonly onBlur = () => {
    this.hasFocus = false;
    this.releaseLease();
    this.onLocalActivityChange("blur");
  };

  private readonly onStorage = (e: StorageEvent) => {
    if (!e.key || e.key !== this.leaseKey) return;
    this.sendHeartbeat("storage").catch(console.error);
  };

  constructor(
    private supabase: SupabaseClientService,
    private authService: AuthService,
    private zone: NgZone
  ) {
    this.deviceId = this.getOrSetId("device_id", localStorage);
    this.tabId = this.getOrSetId("tab_id", sessionStorage);

    this.leaseKey = `presence:${this.deviceId}:activeTab`;

    this.userSub = this.authService.user$.subscribe((user) => {
      if (user) {
        this.currentUserId = user.id;
        this.startTracking();
      } else {
        this.currentUserId = null;
        this.stopTracking();
      }
    });
  }

  private getOrSetId(key: string, storage: Storage): string {
    let id = storage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      storage.setItem(key, id);
    }
    return id;
  }

  private isLocallyEligibleForActive(): boolean {
    return this.visibility === "visible" && this.hasFocus;
  }

  private readLease(): ActiveTabLease | null {
    const raw = localStorage.getItem(this.leaseKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ActiveTabLease;
    } catch {
      return null;
    }
  }

  private isLeaseValid(
    lease: ActiveTabLease | null,
    now = Date.now()
  ): boolean {
    if (!lease) return false;
    return now - lease.ts <= lease.leaseMs;
  }

  private ownsLease(now = Date.now()): boolean {
    const lease = this.readLease();
    return (
      !!lease && this.isLeaseValid(lease, now) && lease.tabId === this.tabId
    );
  }

  private claimLease(): void {
    const now = Date.now();
    const existing = this.readLease();

    if (
      existing &&
      this.isLeaseValid(existing, now) &&
      existing.tabId !== this.tabId
    ) {
      return;
    }

    const next: ActiveTabLease = {
      tabId: this.tabId,
      ts: now,
      leaseMs: this.ACTIVE_LEASE_MS,
    };
    localStorage.setItem(this.leaseKey, JSON.stringify(next));
  }

  private renewLeaseIfOwner(): void {
    if (!this.isLocallyEligibleForActive()) return;
    if (!this.ownsLease()) return;

    const next: ActiveTabLease = {
      tabId: this.tabId,
      ts: Date.now(),
      leaseMs: this.ACTIVE_LEASE_MS,
    };
    localStorage.setItem(this.leaseKey, JSON.stringify(next));
  }

  private releaseLease(): void {
    const lease = this.readLease();
    if (lease?.tabId === this.tabId) {
      localStorage.removeItem(this.leaseKey);
    }
  }

  private getIsActive(): boolean {
    const eligible = this.isLocallyEligibleForActive();
    if (!eligible) return false;

    this.claimLease();
    return this.ownsLease();
  }

  private getHeartbeatIntervalMs(): number {
    return this.getIsActive()
      ? this.ACTIVE_HEARTBEAT_MS
      : this.BACKGROUND_HEARTBEAT_MS;
  }

  private async sendHeartbeat(reason: string) {
    if (!this.currentUserId) return;

    const now = Date.now();
    if (now - this.lastSentAt < 800) return;
    this.lastSentAt = now;

    this.renewLeaseIfOwner();

    const tabData: UserTab = {
      user_id: this.currentUserId,
      device_id: this.deviceId,
      tab_id: this.tabId,
      user_agent: navigator.userAgent,
      is_active: this.getIsActive(),
      last_seen: new Date().toISOString(),
    };

    await this.supabase.upsertUserTab(tabData);
  }

  private clearHeartbeatTimer() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private configureHeartbeatTimer() {
    this.clearHeartbeatTimer();
    const interval = this.getHeartbeatIntervalMs();

    this.zone.runOutsideAngular(() => {
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat("interval").catch(console.error);
      }, interval);
    });
  }

  private onLocalActivityChange(reason: string) {
    if (!this.currentUserId) return;

    if (this.isLocallyEligibleForActive()) {
      this.claimLease();
    }

    this.sendHeartbeat(reason).catch(console.error);
    this.configureHeartbeatTimer();
  }

  private startTracking() {
    this.stopTracking();

    this.hasFocus = document.hasFocus();
    this.visibility = document.visibilityState;

    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("storage", this.onStorage);

    if (this.isLocallyEligibleForActive()) this.claimLease();
    this.sendHeartbeat("start").catch(console.error);
    this.configureHeartbeatTimer();
  }

  private stopTracking() {
    this.clearHeartbeatTimer();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("storage", this.onStorage);

    this.releaseLease();
  }

  ngOnDestroy() {
    this.stopTracking();
    this.userSub.unsubscribe();
  }
}
