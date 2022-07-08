import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GuestbookPage } from './guestbook.page';

const routes: Routes = [
  {
    path: '',
    component: GuestbookPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GuestbookPageRoutingModule {}
