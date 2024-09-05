import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy, NavParams } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot({
    innerHTMLTemplatesEnabled: true,
    experimentalCloseWatcher: true,
    hardwareBackButton: true,
  }), AppRoutingModule, ServiceWorkerModule.register('ngsw-worker.js', {
    enabled: environment.production,
    registrationStrategy: 'registerImmediately'
  })],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    NavParams,
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
