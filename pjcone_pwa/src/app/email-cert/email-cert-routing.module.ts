import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { EmailCertPage } from './email-cert.page';

const routes: Routes = [
  {
    path: '',
    component: EmailCertPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EmailCertPageRoutingModule {}
