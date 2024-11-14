import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ArcadePage } from './arcade.page';

const routes: Routes = [
  {
    path: '',
    component: ArcadePage
  },
  {
    path: 'instant-call',
    loadChildren: () => import('./instant-call/instant-call.module').then(m => m.InstantCallPageModule)
  },
  {
    path: 'void-draw',
    loadChildren: () => import('../subscribes/chat-room/void-draw/void-draw.module').then(m => m.VoidDrawPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ArcadePageRoutingModule { }
