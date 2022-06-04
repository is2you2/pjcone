import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./starcraft-custom/starcraft-custom.module').then(m => m.StarcraftCustomPageModule)
    // redirectTo: 'blog', // 시작하는 페이지
    // pathMatch: 'full'
  },
  {
    path: 'logo',
    loadChildren: () => import('./logo/logo.module').then(m => m.LogoPageModule)
  },
  {
    path: 'email-cert',
    loadChildren: () => import('./account/email-cert/email-cert.module').then(m => m.EmailCertPageModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./account/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'register',
    loadChildren: () => import('./account/register/register.module').then(m => m.RegisterPageModule)
  },
  {
    path: 'portal',
    loadChildren: () => import('./portal/portal.module').then(m => m.PortalPageModule)
  },
  {
    path: 'blog', // 블로그 페이지로 사용
    loadChildren: () => import('./home/home.module').then(m => m.HomePageModule)
  },
  {
    path: 'starcraft_custom',
    loadChildren: () => import('./starcraft-custom/starcraft-custom.module').then(m => m.StarcraftCustomPageModule)
  },
  {
    path: 'pjcone',
    loadChildren: () => import('./pjcone/pjcone.module').then(m => m.PjconePageModule)
  },
  {
    path: 'user-privacy',
    loadChildren: () => import('./user-privacy/user-privacy.module').then(m => m.UserPrivacyPageModule)
  },
  {
    path: 'before-register',
    loadChildren: () => import('./before-register/before-register.module').then(m => m.BeforeRegisterPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
