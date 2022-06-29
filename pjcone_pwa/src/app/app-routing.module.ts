import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'starcraft_custom',
    pathMatch: 'full'
  },
  {
    path: 'starcraft_custom',
    loadChildren: () => import('./starcraft-custom/starcraft-custom.module').then(m => m.StarcraftCustomPageModule)
  },
  {
    path: 'remote/starcraft-custom',
    loadChildren: () => import('./remote/starcraft-custom/starcraft-custom.module').then( m => m.StarcraftCustomPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
