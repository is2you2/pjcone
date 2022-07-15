import { Component, OnInit } from '@angular/core';
import { iosTransitionAnimation, NavController } from '@ionic/angular';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit {

  constructor(
    private nav: NavController,
  ) { }

  ngOnInit() { }

  go_to_licenses() {
    this.nav.navigateForward('settings/licenses', {
      animation: iosTransitionAnimation,
    })
  }
}
