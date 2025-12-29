import { inject } from "@angular/core";
import { Router, CanActivateFn } from "@angular/router";
import { SupabaseClientService } from "../../services/supabase-client.service";

export const authGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const supabaseService = inject(SupabaseClientService);

  const { data } = await supabaseService.supabase.auth.getSession();

  if (data.session) return true;

  router.navigate(["/login"], {
    queryParams: { returnUrl: state.url },
  });

  return false;
};
