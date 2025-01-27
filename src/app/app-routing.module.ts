import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./front/front.module').then(m => m.FrontPageModule)
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
    loadChildren: () => import('./user-fs-dir/user-fs-dir.module').then(m => m.UserFsDirPageModule)
  },
  {
    path: 'group-server',
    loadChildren: () => import('./portal/settings/group-server/group-server.module').then(m => m.GroupServerPageModule)
  },
  {
    path: 'add-todo-menu',
    loadChildren: () => import('./portal/main/add-todo-menu/add-todo-menu.module').then(m => m.AddTodoMenuPageModule)
  },
  {
    path: 'chat-room',
    loadChildren: () => import('./portal/subscribes/chat-room/chat-room.module').then(m => m.ChatRoomPageModule)
  },
  {
    path: 'post-viewer',
    loadChildren: () => import('./portal/community/post-viewer/post-viewer.module').then(m => m.PostViewerPageModule)
  },
  {
    path: 'share-content-to-other',
    loadChildren: () => import('./share-content-to-other/share-content-to-other.module').then(m => m.ShareContentToOtherPageModule)
  },
  {
    path: 'webrtc-manage-io-dev',
    loadChildren: () => import('./webrtc-manage-io-dev/webrtc-manage-io-dev.module').then(m => m.WebrtcManageIoDevPageModule)
  },
  {
    path: 'portal',
    loadChildren: () => import('./portal/portal.module').then(m => m.PortalPageModule)
  },
  {
    path: 'group-detail',
    loadChildren: () => import('./portal/settings/group-detail/group-detail.module').then(m => m.GroupDetailPageModule)
  },
  {
    path: 'instant-call',
    loadChildren: () => import('./portal/arcade/instant-call/instant-call.module').then(m => m.InstantCallPageModule)
  },
  {
    path: 'add-group',
    loadChildren: () => import('./portal/settings/add-group/add-group.module').then(m => m.AddGroupPageModule)
  },
  {
    path: 'void-draw',
    loadChildren: () => import('./portal/subscribes/chat-room/void-draw/void-draw.module').then(m => m.VoidDrawPageModule)
  },
  {
    path: 'ionic-viewer',
    loadChildren: () => import('./portal/subscribes/chat-room/ionic-viewer/ionic-viewer.module').then(m => m.IonicViewerPageModule)
  },
  {
    path: 'server-detail',
    loadChildren: () => import('./portal/settings/group-server/server-detail/server-detail.module').then(m => m.ServerDetailPageModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
