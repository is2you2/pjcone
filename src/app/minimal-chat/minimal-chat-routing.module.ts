import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MinimalChatPage } from './minimal-chat.page';

const routes: Routes = [
  {
    path: '',
    component: MinimalChatPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MinimalChatPageRoutingModule {}
