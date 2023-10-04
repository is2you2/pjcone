import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TtsExportPage } from './tts-export.page';

const routes: Routes = [
  {
    path: '',
    component: TtsExportPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TtsExportPageRoutingModule {}
