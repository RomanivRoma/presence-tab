import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { finalize } from "rxjs/operators";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-auth",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./auth.component.html",
  styleUrls: ["./auth.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthComponent {
  busy = signal(false);
  username = signal("");
  password = signal("");

  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor(private router: Router, private authService: AuthService) {}

  login() {
    if (!this.username() || !this.password()) return;

    this.startAction();

    this.authService
      .login(this.username(), this.password())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.router.navigate(["/app"]),
        error: (err) => {
          this.errorMessage.set("Login failed. Check your email and password.");
        },
      });
  }

  signup() {
    if (!this.username() || !this.password()) return;

    this.startAction();

    this.authService
      .signUp(this.username(), this.password())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set(
            "Success! Check your email to confirm your account."
          );
          this.errorMessage.set(null);
        },
        error: (err) => {
          this.errorMessage.set(err.message || "Signup failed.");
        },
      });
  }

  private startAction() {
    this.busy.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }
}
