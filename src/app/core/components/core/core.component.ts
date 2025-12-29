import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { AuthService } from "../../../services/auth.service";
import { take } from "rxjs";

@Component({
  selector: "app-core",
  templateUrl: "./core.component.html",
  styleUrls: ["./core.component.css"],
})
export class CoreComponent {
  isMenuCollapsed = true;
  constructor(public authService: AuthService) {}

  logout() {
    this.authService.logout().pipe(take(1)).subscribe();
  }
}
