import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'logo', // 시작하는 페이지
    pathMatch: 'full'
  },
  {
    path: 'logo',
    loadChildren: () => import('./logo/logo.module').then( m => m.LogoPageModule)
  },
  {
    path: 'email-cert',
    loadChildren: () => import('./account/email-cert/email-cert.module').then( m => m.EmailCertPageModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./account/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'register',
    loadChildren: () => import('./account/register/register.module').then( m => m.RegisterPageModule)
  },
  {
    path: 'portal',
    loadChildren: () => import('./portal/portal.module').then( m => m.PortalPageModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomePageModule)
  },
  {
    path: 'starcraft-custom',
    loadChildren: () => import('./starcraft-custom/starcraft-custom.module').then( m => m.StarcraftCustomPageModule)
  },
  {
    path: 'pjcone',
    loadChildren: () => import('./pjcone/pjcone.module').then( m => m.PjconePageModule)
  },
  {
    path: 'user-privacy',
    loadChildren: () => import('./user-privacy/user-privacy.module').then( m => m.UserPrivacyPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
