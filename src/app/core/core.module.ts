import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { CoreRoutingModule } from "./core-routing.module";
import { CoreComponent } from "./components/core/core.component";
import { RouterModule } from "@angular/router";

@NgModule({
  declarations: [CoreComponent],
  imports: [CommonModule, RouterModule, CoreRoutingModule],
})
export class CoreModule {}
