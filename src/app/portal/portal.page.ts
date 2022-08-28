import { Component, OnInit } from '@angular/core';
import { iosTransitionAnimation, NavController } from '@ionic/angular';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  constructor(
    private nav: NavController,
  ) { }

  ngOnInit() { }

  /** 하단 탭을 눌러 설정페이지로 이동 */
  setting_button() {
    this.nav.navigateForward('settings', {
      animation: iosTransitionAnimation,
    });
  }
}
