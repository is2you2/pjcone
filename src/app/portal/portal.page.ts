import { Component, OnInit, ViewChild } from '@angular/core';
import { IonTabs, iosTransitionAnimation, NavController } from '@ionic/angular';
import { NakamaService } from '../nakama.service';
import { GlobalActService } from '../global-act.service';
import { IndexedDBService } from '../indexed-db.service';
import { WebrtcService } from '../webrtc.service';
import { StatusManageService } from '../status-manage.service';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.page.html',
  styleUrls: ['./portal.page.scss'],
})
export class PortalPage implements OnInit {

  @ViewChild(IonTabs) ionTabs: IonTabs;

  constructor(
    private navCtrl: NavController,
    public nakama: NakamaService,
    public global: GlobalActService,
    public indexed: IndexedDBService,
    private _webrtc: WebrtcService, // constructor 단계 수행을 위해 로드만 함
    public statusBar: StatusManageService,
  ) { }

  ngOnInit() { }

  OnInit = true;

  ionViewWillEnter() {
    this.global.FocusOnPortal = true;
  }

  ionViewDidEnter() {
    if (this.CacheKeyShortCut)
      this.global.p5KeyShortCut = this.CacheKeyShortCut;
    this.try_add_shortcut();
    if (this.global.p5todoPlayCanvas && this.TodoIcon == 'checkbox')
      this.global.p5todoPlayCanvas();
    if (this.nakama.AfterLoginAct.length) // 빠른 진입 행동 보완
      this.global.RemoveAllModals(() => {
        this.nakama.open_profile_page();
      });
    if (this.OnInit) {
      if (!this.nakama.StartPage) this.nakama.StartPage = localStorage.getItem('StartPage') || '0';
      switch (this.nakama.StartPage) {
        case '1':
          this.subscribe_button();
          this.ionTabs.select('subscribes');
          break;
        case '2':
          this.arcade_tab_selected();
          this.ionTabs.select('arcade');
          break;
        case '3':
          this.community_tab_selected();
          this.ionTabs.select('community');
          break;
      }
      this.OnInit = false;
    }
  }

  /** 포털 화면 단축키 구성 */
  try_add_shortcut() {
    if (this.global.p5key && this.global.p5KeyShortCut)
      this.global.p5KeyShortCut['BottomTab'] = (char: string) => {
        switch (char) {
          case 'Q':
            this.bottom_tab_selected();
            this.ionTabs.select('main');
            break;
          case 'W':
            this.subscribe_button();
            this.ionTabs.select('subscribes');
            break;
          case 'E': // 상황에 따라, 커뮤니티 또는 설정
            this.arcade_tab_selected();
            this.ionTabs.select('arcade');
            break;
          case 'R':
            this.community_tab_selected();
            this.ionTabs.select('community');
            break;
          case 'T':
            this.setting_button();
            break;
        }
      }
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  /** 하단 탭을 눌러 알림 확인함 처리 */
  subscribe_button() {
    this.nakama.has_new_channel_msg = false;
    if (this.SubscribesIcon == 'chatbubble') {
      if (this.global.PortalBottonTabAct.Subscribes)
        this.global.PortalBottonTabAct.Subscribes();
    }
    this.SubscribesIcon = 'chatbubble';
    this.TodoIcon = 'checkbox-outline';
    this.CommunityIcon = 'newspaper-outline';
    this.ArcadeIcon = 'game-controller-outline';
  }

  /** 하단 탭을 눌러 설정페이지로 이동 */
  setting_button() {
    this.global.RemoveAllModals(() => {
      this.navCtrl.navigateForward('portal/settings', {
        animation: iosTransitionAnimation,
      });
    });
  }

  TodoIcon = 'checkbox';
  SubscribesIcon = 'chatbubble-outline';
  ArcadeIcon = 'game-controller-outline';
  CommunityIcon = 'newspaper-outline';

  /** 구 버전 함수 이름이 계승됨, 할 일이 눌렸을 때 */
  bottom_tab_selected() {
    this.SubscribesIcon = 'chatbubble-outline';
    if (this.TodoIcon == 'checkbox') {
      if (this.global.PortalBottonTabAct.Todo)
        this.global.PortalBottonTabAct.Todo();
    }
    this.TodoIcon = 'checkbox';
    this.CommunityIcon = 'newspaper-outline';
    this.ArcadeIcon = 'game-controller-outline';
  }

  arcade_tab_selected() {
    this.SubscribesIcon = 'chatbubble-outline';
    this.TodoIcon = 'checkbox-outline';
    if (this.ArcadeIcon == 'game-controller') {
      if (this.global.PortalBottonTabAct.Arcade)
        this.global.PortalBottonTabAct.Arcade();
    }
    this.ArcadeIcon = 'game-controller';
    this.CommunityIcon = 'newspaper-outline';
  }

  community_tab_selected() {
    this.SubscribesIcon = 'chatbubble-outline';
    this.TodoIcon = 'checkbox-outline';
    if (this.CommunityIcon == 'newspaper') {
      if (this.global.PortalBottonTabAct.Community)
        this.global.PortalBottonTabAct.Community();
    }
    this.CommunityIcon = 'newspaper';
    this.ArcadeIcon = 'game-controller-outline';
  }

  CacheKeyShortCut: any;
  ionViewWillLeave() {
    this.global.FocusOnPortal = false;
    if (this.global.FocusOnPortalLeaveAct)
      this.global.FocusOnPortalLeaveAct();
    this.CacheKeyShortCut = this.global.p5KeyShortCut;
    this.global.p5KeyShortCut = {};
    if (this.global.p5todoStopCanvas)
      this.global.p5todoStopCanvas();
  }
}
