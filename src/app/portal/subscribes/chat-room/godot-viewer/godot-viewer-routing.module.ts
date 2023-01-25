import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GodotViewerPage } from './godot-viewer.page';

const routes: Routes = [
  {
    path: '',
    component: GodotViewerPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GodotViewerPageRoutingModule {}
