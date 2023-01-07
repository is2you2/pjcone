import { Component, OnInit } from '@angular/core';
import { iosTransitionAnimation, ModalController, NavController } from '@ionic/angular';
import { IndexedDBService } from '../indexed-db.service';
import { ProfilePage } from './settings/profile/profile.page';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  constructor(
    private nav: NavController,
    private indexed: IndexedDBService,
    private modalCtrl: ModalController,
  ) { }

  ngOnInit() {
    this.indexed.loadTextFromUserPath('servers/self/profile.json', (e, _v) => {
      if (!e)  // 프로필 정보 없는 상태
        this.modalCtrl.create({
          component: ProfilePage
        }).then(v => v.present());
    });
  }

  /** 하단 탭을 눌러 설정페이지로 이동 */
  setting_button() {
    this.nav.navigateForward('settings', {
      animation: iosTransitionAnimation,
    });
  }
}
