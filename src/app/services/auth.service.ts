import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject, from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { SupabaseClientService } from "./supabase-client.service";
import { ApplicationUser } from "../core/interfaces";

@Injectable({ providedIn: "root" })
export class AuthService {
  private _user = new BehaviorSubject<ApplicationUser | null>(null);
  user$ = this._user.asObservable();

  constructor(private router: Router, private supabase: SupabaseClientService) {
    this.initialize();
  }

  private async initialize() {
    const { data } = await this.supabase.supabase.auth.getSession();
    this.handleUserChange(data.session?.user);

    this.supabase.authChanges((event, session) => {
      this.handleUserChange(session?.user);
      if (event === "SIGNED_OUT") {
        this.router.navigate(["/login"]);
      }
    });
  }

  private handleUserChange(user: any) {
    if (user)
      this._user.next({
        username: user.email,
        email: user.email,
        id: user.id,
      });
    else this._user.next(null);
  }

  login(email: string, pass: string) {
    return from(this.supabase.signIn(email, pass)).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data;
      })
    );
  }

  signUp(email: string, pass: string) {
    return from(this.supabase.signUp(email, pass)).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data;
      })
    );
  }

  logout() {
    return from(this.supabase.signOut());
  }
}
