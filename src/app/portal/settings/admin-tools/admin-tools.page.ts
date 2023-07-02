import { Component, OnInit } from '@angular/core';
import { LanguageSettingService } from 'src/app/language-setting.service';

@Component({
  selector: 'app-admin-tools',
  templateUrl: './admin-tools.page.html',
  styleUrls: ['./admin-tools.page.scss'],
})
export class AdminToolsPage implements OnInit {

  constructor(
    public lang: LanguageSettingService,
  ) { }

  ngOnInit() { }

}
