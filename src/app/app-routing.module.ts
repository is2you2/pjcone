import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./portal/portal.module').then(m => m.PortalPageModule)
  },
  {
    path: 'minimal-chat',
    loadChildren: () => import('./minimal-chat/minimal-chat.module').then(m => m.MinimalChatPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
