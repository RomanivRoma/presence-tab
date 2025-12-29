import { Injectable } from "@angular/core";
import {
  AuthChangeEvent,
  AuthSession,
  createClient,
  Session,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import { environment } from "../../environments/environment";
import { UserTab } from "../core/interfaces";

@Injectable({ providedIn: "root" })
export class SupabaseClientService {
  supabase: SupabaseClient;
  _session: AuthSession | null = null;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  get session() {
    return this._session;
  }

  authChanges(
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ) {
    return this.supabase.auth.onAuthStateChange((event, session) => {
      this._session = session;
      callback(event, session);
    });
  }

  signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  signUp(email: string, password: string) {
    return this.supabase.auth.signUp({ email, password });
  }

  signOut() {
    return this.supabase.auth.signOut();
  }

  upsertUserTab(tab: UserTab) {
    return this.supabase.from("user_tabs").upsert(tab);
  }

  getUserTabs() {
    return this.supabase
      .from("user_tabs")
      .select("*")
      .order("last_seen", { ascending: false });
  }

  profile(user: User) {
    return this.supabase
      .from("profiles")
      .select(`username, website, avatar_url`)
      .eq("id", user.id)
      .single();
  }
}
