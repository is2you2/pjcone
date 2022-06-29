import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-logo',
  templateUrl: './logo.page.html',
  styleUrls: ['./logo.page.scss'],
})
export class LogoPage implements OnInit {

  constructor(private navCtrl: NavController,
  ) { }

  ngOnInit() {
    setTimeout(() => {
      this.navCtrl.navigateRoot('portal', {
        animated: true,
        animationDirection: 'forward',
      });
    }, 1400);
  }

}
