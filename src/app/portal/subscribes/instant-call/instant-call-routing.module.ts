import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { InstantCallPage } from './instant-call.page';

const routes: Routes = [
  {
    path: '',
    component: InstantCallPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InstantCallPageRoutingModule {}
