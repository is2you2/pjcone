import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy, NavParams } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { File } from "@awesome-cordova-plugins/file/ngx";
import { Clipboard } from "@awesome-cordova-plugins/clipboard/ngx";

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot({
    innerHTMLTemplatesEnabled: true,
    experimentalCloseWatcher: true,
    hardwareBackButton: true,
  }), AppRoutingModule, ServiceWorkerModule.register('assets/sw.js', {
    enabled: environment.production,
    // Register the ServiceWorker as soon as the application is stable
    // or after 30 seconds (whichever comes first).
    registrationStrategy: 'registerWhenStable:30000'
  })],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    File,
    NavParams,
    Clipboard,
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
