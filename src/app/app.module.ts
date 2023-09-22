import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy, NavParams } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { LocalNotifications } from '@awesome-cordova-plugins/local-notifications/ngx';
import { BarcodeScanner } from "@awesome-cordova-plugins/barcode-scanner/ngx";
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { Camera } from "@awesome-cordova-plugins/camera/ngx";
import { File } from "@awesome-cordova-plugins/file/ngx";
import { FileOpener } from "@awesome-cordova-plugins/file-opener/ngx";
import { Clipboard } from "@awesome-cordova-plugins/clipboard/ngx";

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule, ServiceWorkerModule.register('ngsw-worker.js', {
    enabled: environment.production,
    // Register the ServiceWorker as soon as the application is stable
    // or after 30 seconds (whichever comes first).
    registrationStrategy: 'registerWhenStable:30000'
  })],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    Device,
    File,
    Camera,
    BackgroundMode,
    NavParams,
    LocalNotifications,
    BarcodeScanner,
    FileOpener,
    Clipboard,
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
