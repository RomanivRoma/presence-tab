import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  NgZone,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { SupabaseClientService } from "../../services/supabase-client.service";
import { PresenceService } from "../../services/presence.service";
import { AuthService } from "../../services/auth.service";
import { UserTab } from "../../core/interfaces";

export enum TabStatus {
  Active = "Active",
  Idle = "Idle",
  Stale = "Stale",
}

type UserTabVM = UserTab & {
  status: TabStatus;
  isCurrentTab: boolean;
  ageMs: number;
};

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./dashboard.component.html",
})
export class DashboardComponent implements OnInit, OnDestroy {
  public presence = inject(PresenceService);
  private supabase = inject(SupabaseClientService);
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  private rawTabs = signal<UserTab[]>([]);
  private now = signal(Date.now());

  private refreshTimer: any;
  private realtimeChannel: any;

  private readonly ACTIVE_TTL_MS = 20000;
  private readonly IDLE_TTL_MS = 120000;

  groupedTabs = computed(() => {
    const tabs = this.rawTabs();
    const timestamp = this.now();
    const map = new Map<string, UserTabVM[]>();

    for (const tab of tabs) {
      const vm: UserTabVM = {
        ...tab,
        status: this.calculateStatus(tab, timestamp),
        isCurrentTab: this.isCurrentTab(tab),
        ageMs: timestamp - new Date(tab.last_seen).getTime(),
      };

      if (!map.has(tab.device_id)) map.set(tab.device_id, []);
      map.get(tab.device_id)!.push(vm);
    }

    return Array.from(map.entries()).map(([deviceId, deviceTabs]) => ({
      deviceId,
      tabs: deviceTabs.sort((a, b) => {
        if (a.isCurrentTab !== b.isCurrentTab) return a.isCurrentTab ? -1 : 1;

        const rank = (s: TabStatus) =>
          s === TabStatus.Active ? 0 : s === TabStatus.Idle ? 1 : 2;

        const byStatus = rank(a.status) - rank(b.status);
        if (byStatus !== 0) return byStatus;

        return (
          new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
        );
      }),
    }));
  });

  ngOnInit() {
    this.fetchData().catch((err) =>
      console.error("Initial data load failed:", err)
    );

    this.realtimeChannel = this.supabase.supabase
      .channel("public:user_tabs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_tabs" },
        () => {
          this.zone.run(() => {
            this.fetchData().catch((err) =>
              console.error("Refetch failed:", err)
            );
          });
        }
      )
      .subscribe((status: string, error: any) => {
        if (status === "SUBSCRIBED") {
          this.fetchData().catch((err) =>
            console.error("Refetch failed:", err)
          );
        } else if (status === "CHANNEL_ERROR") {
          console.error("Realtime Error:", error);
        } else if (status === "TIMED_OUT") {
          console.warn("Realtime Timed Out - Retrying...");
        }
      });

    this.refreshTimer = setInterval(() => this.now.set(Date.now()), 1000);

    document.addEventListener("visibilitychange", this.onLocalActivityEdge, {
      passive: true,
    });
    window.addEventListener("focus", this.onLocalActivityEdge, {
      passive: true,
    });
    window.addEventListener("blur", this.onLocalActivityEdge, {
      passive: true,
    });
    window.addEventListener("storage", this.onStorageEdge, { passive: true });
  }

  private onLocalActivityEdge = () => {
    this.zone.run(() => {
      this.now.set(Date.now());
      this.fetchData().catch(() => {});
    });
  };

  private onStorageEdge = (e: StorageEvent) => {
    if (!e.key) return;
    if (!e.key.startsWith(`presence:${this.presence.deviceId}:`)) return;

    this.zone.run(() => {
      this.now.set(Date.now());
      this.fetchData().catch(() => {});
    });
  };

  private isViewerTabLocallyActive(): boolean {
    return document.visibilityState === "visible" && document.hasFocus();
  }

  async fetchData() {
    const { data, error } = await this.supabase.getUserTabs();
    if (error) throw error;
    this.rawTabs.set((data ?? []) as UserTab[]);
  }

  private calculateStatus(tab: UserTab, now: number): TabStatus {
    if (this.isCurrentTab(tab) && this.isViewerTabLocallyActive()) {
      const lastSeen = new Date(tab.last_seen).getTime();
      const age = now - lastSeen;

      if (age <= this.IDLE_TTL_MS) return TabStatus.Active;
    }

    const lastSeen = new Date(tab.last_seen).getTime();
    const age = now - lastSeen;

    if (tab.is_active) {
      if (age <= this.ACTIVE_TTL_MS) return TabStatus.Active;
      if (age <= this.IDLE_TTL_MS) return TabStatus.Idle;
      return TabStatus.Stale;
    } else {
      if (age <= this.IDLE_TTL_MS) return TabStatus.Idle;
      return TabStatus.Stale;
    }
  }

  isCurrentTab(tab: UserTab): boolean {
    return (
      tab.device_id === this.presence.deviceId &&
      tab.tab_id === this.presence.tabId
    );
  }

  getStatusColor(status?: TabStatus) {
    switch (status) {
      case TabStatus.Active:
        return "#28a745";
      case TabStatus.Idle:
        return "#ffc107";
      case TabStatus.Stale:
      default:
        return "#6c757d";
    }
  }

  logout() {
    this.auth.logout();
  }

  ngOnDestroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);

    document.removeEventListener("visibilitychange", this.onLocalActivityEdge);
    window.removeEventListener("focus", this.onLocalActivityEdge);
    window.removeEventListener("blur", this.onLocalActivityEdge);
    window.removeEventListener("storage", this.onStorageEdge);

    if (this.realtimeChannel) {
      this.supabase.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}
