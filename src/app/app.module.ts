import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy, NavParams } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { Device } from '@awesome-cordova-plugins/device/ngx';
import { BackgroundMode } from '@awesome-cordova-plugins/background-mode/ngx';
import { LocalNotifications } from '@awesome-cordova-plugins/local-notifications/ngx';
import { File } from "@awesome-cordova-plugins/file/ngx";
import { HTTP } from "@awesome-cordova-plugins/http/ngx";
import { BarcodeScanner } from "@awesome-cordova-plugins/barcode-scanner/ngx";

@NgModule({
  declarations: [AppComponent],
  entryComponents: [],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    Device,
    BackgroundMode,
    NavParams,
    LocalNotifications,
    File,
    HTTP,
    BarcodeScanner,
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
