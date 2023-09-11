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
  {
    path: 'others-profile',
    loadChildren: () => import('./others-profile/others-profile.module').then(m => m.OthersProfilePageModule)
  },
  {
    path: 'user-fs-dir',
    loadChildren: () => import('./user-fs-dir/user-fs-dir.module').then( m => m.UserFsDirPageModule)
  },
  {
    path: 'add-todo-menu',
    loadChildren: () => import('./portal/main/add-todo-menu/add-todo-menu.module').then( m => m.AddTodoMenuPageModule)
  },
  {
    path: 'chat-room',
    loadChildren: () => import('./portal/subscribes/chat-room/chat-room.module').then( m => m.ChatRoomPageModule)
  },
  {
    path: 'share-content-to-other',
    loadChildren: () => import('./share-content-to-other/share-content-to-other.module').then( m => m.ShareContentToOtherPageModule)
  },
  {
    path: 'webrtc-manage-io-dev',
    loadChildren: () => import('./webrtc-manage-io-dev/webrtc-manage-io-dev.module').then( m => m.WebrtcManageIoDevPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
