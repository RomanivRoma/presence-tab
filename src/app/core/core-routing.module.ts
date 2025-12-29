import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { CoreComponent } from "./components/core/core.component";
import { authGuard } from "./guards/auth.guard";

const routes: Routes = [
  {
    path: "",
    component: CoreComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: "",
        redirectTo: "app",
        pathMatch: "full",
      },
      {
        path: "app",
        loadComponent: () =>
          import("../routes/dashboard/dashboard.component").then(
            (m) => m.DashboardComponent
          ),
      },
    ],
  },
  {
    path: "login",
    loadComponent: () =>
      import("../routes/auth/auth.component").then((m) => m.AuthComponent),
  },
  {
    path: "404",
    loadComponent: () =>
      import("../routes/not-found/not-found.component").then(
        (m) => m.NotFoundComponent
      ),
  },
  {
    path: "**",
    redirectTo: "/404",
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CoreRoutingModule {}
