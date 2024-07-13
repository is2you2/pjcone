import { Component, OnInit } from '@angular/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { AlertController, LoadingController, ModalController, NavController } from '@ionic/angular';
import { SERVER_PATH_ROOT, isPlatform } from 'src/app/app.component';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';
import { StatusManageService } from 'src/app/status-manage.service';
import { AddGroupPage } from '../settings/add-group/add-group.page';
import { QRelsePage } from './qrelse/qrelse.page';
import { GlobalActService } from 'src/app/global-act.service';
import { IndexedDBService } from 'src/app/indexed-db.service';
import { GroupDetailPage } from '../settings/group-detail/group-detail.page';
import { MinimalChatPage } from 'src/app/minimal-chat/minimal-chat.page';

@Component({
  selector: 'app-subscribes',
  templateUrl: './subscribes.page.html',
  styleUrls: ['./subscribes.page.scss'],
})
export class SubscribesPage implements OnInit {

  constructor(
    private modalCtrl: ModalController,
    private p5toast: P5ToastService,
    public nakama: NakamaService,
    public statusBar: StatusManageService,
    public lang: LanguageSettingService,
    private global: GlobalActService,
    private navCtrl: NavController,
    private indexed: IndexedDBService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
  ) { }

  ngOnInit() {
    this.indexed.loadTextFromUserPath('servers/self/profile.img', (e, v) => {
      if (e && v) this.nakama.users.self['img'] = v.replace(/"|=|\\/g, '');
    });
  }

  /** 광고 정보 불러오기 */
  async checkAdsInfo() {
    try {
      let res = await fetch(`${SERVER_PATH_ROOT}pjcone_ads/${this.lang.lang}.txt`);
      if (res.ok) {
        let text = await (await res.blob()).text();
        this.indexed.saveTextFileToUserPath(text, 'ads_list.txt');
        let lines: string[] = text.split('\n');
        this.listAvailableAds(lines);
      } else throw "광고가 없는 것으로 단정합니다";
    } catch (e) { // 로컬 정보 기반으로 광고
      this.indexed.loadTextFromUserPath('ads_list.txt', (e, v) => {
        if (e && v) this.listAvailableAds(v.split('\n'));
      });
    }
  }

  /** 사용가능한 광고 리스트 추리기 */
  availables = [];
  /** 광고 판넬 구성하기 */
  listAvailableAds(lines: string[]) {
    let currentTime = new Date().getTime();
    // 양식: 시작시간,끝시간,사이트주소
    this.availables.length = 0;
    let NotYet: number;
    for (let i = 0, j = lines.length; i < j; i++) {
      let sep = lines[i].split(',');
      if (Number(sep[0]) < currentTime) {
        if (currentTime < Number(sep[1]))
          this.availables.push([Number(sep[0]), Number(sep[1]), sep[2]]);
      } else { // 아직 도래하지 않은 광고리스트
        if (!NotYet) NotYet = Number(sep[0]);
        else if (Number(sep[0]) < NotYet)
          NotYet = Number(sep[0]);
      }
    }
    let children = this.AD_Div.childNodes;
    children.forEach(child => {
      child.remove();
    });
    if (this.availables.length)
      this.displayRandomAds();
    else if (NotYet) {
      this.refreshAds = setTimeout(() => {
        this.checkAdsInfo();
      }, NotYet - new Date().getTime());
    }
  }

  /** 광고 게시 여부 */
  isAdHiding = true;
  refreshAds: any;
  AD_Div: HTMLElement;
  displayRandomAds() {
    this.isAdHiding = true;
    let randomIndex = Math.floor(Math.random() * this.availables.length);
    let currentAd = this.availables[randomIndex];
    this.refreshAds = setTimeout(() => {
      this.indexed.loadTextFromUserPath('ads_list.txt', (e, v) => {
        if (e && v) this.listAvailableAds(v.split('\n'));
      });
    }, currentAd[1] - new Date().getTime());
    let AdFrame = document.createElement('iframe');
    AdFrame.id = 'AdFrame';
    AdFrame.setAttribute("src", currentAd[2]);
    AdFrame.setAttribute("frameborder", "0");
    AdFrame.setAttribute('class', 'full_screen');
    this.isAdHiding = false;
    this.AD_Div.appendChild(AdFrame);
  }

  /** 웹 사이트 주소 열기 */
  open_link(_link: string) {
    window.open(_link, '_system')
  }

  cant_dedicated = false;

  try_add_shortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut'])
      this.AddShortcut();
    else setTimeout(() => {
      this.try_add_shortcut();
    }, 100);
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut']) {
      this.global.p5key['KeyShortCut']['Backquote'] = () => {
        this.go_to_page('group-server');
      }
      this.global.p5key['KeyShortCut']['Digit'] = (index: number) => {
        if (this.nakama.channels.length > index)
          this.go_to_chatroom(this.nakama.channels[index]);
        else this.add_new_group();
      };
    }
    if (this.global.p5key && this.global.p5key['KeyShortCut']
      && !this.global.p5key['KeyShortCut']['AddAct'])
      this.global.p5key['KeyShortCut']['AddAct'] = () => {
        this.add_new_group();
      };
  }

  /** 채널 우클릭 행동 */
  ChannelContextMenu(channel: any) {
    let isOfficial = channel['server'].isOfficial;
    let target = channel['server'].target;
    let targetHeader = channel['info'].name || channel['info'].display_name;
    if (channel['redirect'].type == 2) // 1:1 대화인 경우
      targetHeader = targetHeader || this.lang.text['Profile']['noname_user'];
    else targetHeader = targetHeader || this.lang.text['ChatRoom']['noname_chatroom'];
    switch (channel['redirect'].type) {
      case 3: // 그룹 채널
        if (channel['status'] == 'online' || channel['status'] == 'pending') {
          this.modalCtrl.create({
            component: GroupDetailPage,
            componentProps: {
              info: this.nakama.groups[isOfficial][target][channel['group_id']],
              server: { isOfficial: isOfficial, target: target },
            },
          }).then(v => {
            let cache_func = this.global.p5key['KeyShortCut'];
            this.global.p5key['KeyShortCut'] = {};
            v.onDidDismiss().then(() => {
              this.global.p5key['KeyShortCut'] = cache_func;
            });
            v.present();
          });
          break;
        } // 온라인 그룹이 아니라면 1:1 채널과 같게 처리
      case 2: // 1:1 채널
        // 온라인 상태의 1:1 채널이라면
        if (channel['status'] == 'online' || channel['status'] == 'pending') {
          this.alertCtrl.create({
            header: targetHeader,
            message: this.lang.text['ChatRoom']['UnlinkChannel'],
            buttons: [{
              text: this.lang.text['ChatRoom']['LogOut'],
              handler: async () => {
                try { // 채널 차단 처리
                  await this.nakama.servers[isOfficial][target].socket.leaveChat(channel.id);
                  this.nakama.channels_orig[isOfficial][target][channel.id]['status'] = 'missing';
                } catch (e) {
                  console.error('채널에서 나오기 실패: ', e);
                }
                this.nakama.rearrange_channels();
              },
              cssClass: 'redfont',
            }]
          }).then(v => v.present());
        } else this.alertCtrl.create({ // 손상 처리된 채널이라면 (그룹, 1:1이 같은 처리를 따름)
          header: targetHeader,
          message: this.lang.text['ChatRoom']['RemoveChannelLogs'],
          buttons: [{
            text: this.lang.text['ChatRoom']['Delete'],
            handler: async () => {
              let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
              loading.present();
              await this.nakama.remove_group_list(this.nakama.channels_orig[isOfficial][target][channel.id]['info'], isOfficial, target, true);
              delete this.nakama.channels_orig[isOfficial][target][channel.id];
              this.nakama.remove_channel_files(isOfficial, target, channel.id);
              // 해당 채널과 관련된 파일 일괄 삭제 (cdn / ffs)
              try { // FFS 요청 우선
                let fallback = localStorage.getItem('fallback_fs');
                if (!fallback) throw '사용자 지정 서버 없음';
                let address = fallback.split(':');
                let checkProtocol = address[0].replace(/(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/g, '');
                let protocol = checkProtocol ? 'https:' : 'http:';
                let target_address = `${protocol}//${address[0]}:${address[1] || 9002}/`;
                // 로컬 채널이라고 가정하고 일단 타겟 키를 만듦
                let target_key = `${channel.id}_${this.nakama.users.self['display_name']}`;
                try { // 원격 채널일 경우를 대비해 타겟 키를 바꿔치기 시도
                  target_key = `${channel['info'].id}_${this.nakama.servers[isOfficial][target].session.user_id}`
                } catch (e) { }
                this.global.remove_files_from_storage_with_key(target_address, target_key);
              } catch (e) { }
              try { // cdn 삭제 요청, 로컬 채널은 주소 만들다가 알아서 튕김
                let protocol = channel['info'].server.useSSL ? 'https:' : 'http:';
                let address = channel['info'].server.address;
                let target_address = `${[protocol]}//${address}:9002/`;
                this.global.remove_files_from_storage_with_key(target_address, `${channel['info'].id}_${this.nakama.servers[isOfficial][target].session.user_id}`);
              } catch (e) { }
              let list = await this.indexed.GetFileListFromDB(`servers/${isOfficial}/${target}/channels/${channel.id}`);
              for (let i = 0, j = list.length; i < j; i++) {
                loading.message = `${this.lang.text['UserFsDir']['DeleteFile']}: ${j - i}`
                await this.indexed.removeFileFromUserPath(list[i]);
              }
              loading.dismiss();
              this.nakama.rearrange_channels();
            },
            cssClass: 'redfont',
          }]
        }).then(v => v.present());
        break;
      case 0: // 로컬 채널
        this.alertCtrl.create({
          header: targetHeader,
          message: this.lang.text['ChatRoom']['RemoveChannelLogs'],
          buttons: [{
            text: this.lang.text['ChatRoom']['Delete'],
            handler: async () => {
              let loading = await this.loadingCtrl.create({ message: this.lang.text['TodoDetail']['WIP'] });
              loading.present();
              delete this.nakama.channels_orig[isOfficial][target][channel.id];
              try { // 그룹 이미지 삭제
                await this.indexed.removeFileFromUserPath(`servers/${isOfficial}/${target}/groups/${channel.id}.img`);
              } catch (e) {
                console.log('그룹 이미지 삭제 오류: ', e);
              }
              this.nakama.save_groups_with_less_info();
              // 해당 채널과 관련된 파일 일괄 삭제 (cdn)
              try { // FFS 요청 우선
                let fallback = localStorage.getItem('fallback_fs');
                if (!fallback) throw '사용자 지정 서버 없음';
                let address = fallback.split(':');
                let checkProtocol = address[0].replace(/(\b25[0-5]|\b2[0-4][0-9]|\b[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}/g, '');
                let protocol = checkProtocol ? 'https:' : 'http:';
                let target_address = `${protocol}//${address[0]}:${address[1] || 9002}/`;
                // 로컬 채널이라고 가정하고 일단 타겟 키를 만듦
                let target_key = `${channel.id}_${this.nakama.users.self['display_name']}`;
                try { // 원격 채널일 경우를 대비해 타겟 키를 바꿔치기 시도
                  target_key = `${channel['info'].id}_${this.nakama.servers[isOfficial][target].session.user_id}`
                } catch (e) { }
                this.global.remove_files_from_storage_with_key(target_address, target_key);
              } catch (e) { }
              let list = await this.indexed.GetFileListFromDB(`servers/${isOfficial}/${target}/channels/${channel.id}`);
              for (let i = 0, j = list.length; i < j; i++) {
                loading.message = `${this.lang.text['UserFsDir']['DeleteFile']}: ${j - i}`
                await this.indexed.removeFileFromUserPath(list[i]);
              }
              loading.dismiss();
              this.nakama.rearrange_channels();
            },
            cssClass: 'redfont',
          }]
        }).then(v => v.present());
        break;
    }
    return false;
  }

  ionViewWillEnter() {
    this.AD_Div = document.getElementById('advertise');
    this.checkAdsInfo();
  }

  ionViewDidEnter() {
    this.nakama.subscribe_lock = true;
    if (isPlatform == 'DesktopPWA' || isPlatform == 'MobilePWA')
      this.cant_dedicated = true;
    this.try_add_shortcut();
  }

  go_to_page(_page: string) {
    this.navCtrl.navigateForward(`portal/settings/${_page}`);
  }

  StartScan = false;
  // 웹에 있는 QRCode는 무조건 json[]로 구성되어있어야함
  async scanQRCode() {
    let perm = await BarcodeScanner.checkPermissions();
    const complete = '온전한 동작 후 종료';
    try {
      if (perm.camera != 'granted' || this.StartScan) throw '시작 불가상태';
      this.StartScan = true;
      document.querySelector('body').setAttribute('style', 'visibility: hidden; --background: transparent; --ion-background-color: transparent;');
      window.onpopstate = () => {
        this.StopScan();
      };
      await BarcodeScanner.addListener(
        'barcodeScanned',
        async result => {
          try { // 양식에 맞게 끝까지 동작한다면 우리 데이터가 맞다
            if (result.barcode.displayValue.trim().indexOf(`${SERVER_PATH_ROOT}pjcone_pwa/?`) != 0)
              throw '주소 시작이 다름';
            await this.nakama.AddressToQRCodeAct(this.global.CatchGETs(result.barcode.displayValue.trim()));
          } catch (e) { // 양식에 맞춰 행동할 수 없다면 모르는 데이터다
            this.modalCtrl.create({
              component: QRelsePage,
              componentProps: { result: result.barcode },
            }).then(v => v.present());
          }
          this.StopScan();
        },
      );
      await BarcodeScanner.startScan();
    } catch (e) {
      if (e != complete)
        this.p5toast.show({
          text: this.lang.text['Subscribes']['CameraPermissionDenied'],
        });
      this.StopScan();
    }
  }

  /** 페이지 이동 제한 (중복 행동 방지용) */
  lock_modal_open = false;
  /** 익명성 그룹 채널에 참가하기 */
  JoinSmallTalk() {
    if (!this.lock_modal_open) {
      this.lock_modal_open = true;
      if (this.statusBar.settings['dedicated_groupchat'] != 'online'
        && this.statusBar.settings['dedicated_groupchat'] != 'certified')
        this.statusBar.settings['dedicated_groupchat'] = 'pending';

      this.modalCtrl.create({
        component: MinimalChatPage,
        componentProps: {
          name: this.nakama.users.self['display_name'],
        },
      }).then(async v => {
        // 이전 페이지의 단축키 보관했다가 재등록시키기
        let CacheShortCut = this.global.p5key['KeyShortCut'];
        this.global.p5key['KeyShortCut'] = {};
        v.onDidDismiss().then(() => {
          this.global.p5key['KeyShortCut'] = CacheShortCut;
        });
        await v.present();
        this.lock_modal_open = false;
      });
    }
  }

  StopScan() {
    if (isPlatform == 'Android' || isPlatform == 'iOS') {
      this.StartScan = false;
      document.querySelector('body')?.removeAttribute('style');
      BarcodeScanner.removeAllListeners();
      BarcodeScanner.stopScan();
    }
  }

  lock_chatroom = false;
  /** 채팅방으로 이동하기 */
  go_to_chatroom(info: any) {
    if (!this.lock_chatroom) {
      this.lock_chatroom = true;
      this.nakama.go_to_chatroom_without_admob_act(info);
      if (info['status'] != 'online' || info['status'] != 'pending')
        delete info['is_new'];
      this.lock_chatroom = false;
    }
  }

  /** Nakama 서버 알림 읽기 */
  check_notifications(i: number) {
    let server_info = this.nakama.notifications_rearrange[i]['server'];
    let _is_official = server_info['isOfficial'];
    let _target = server_info['target'];
    this.nakama.check_notifications(this.nakama.notifications_rearrange[i], _is_official, _target);
  }

  /** 새 그룹 추가하기 */
  add_new_group() {
    this.modalCtrl.create({
      component: AddGroupPage,
    }).then(v => {
      let cache_func = this.global.p5key['KeyShortCut'];
      this.global.p5key['KeyShortCut'] = {};
      v.onDidDismiss().then(() => {
        this.global.p5key['KeyShortCut'] = cache_func;
        this.try_add_shortcut();
      });
      v.present();
    });
  }

  ionViewWillLeave() {
    this.nakama.subscribe_lock = false;
    delete this.global.p5key['KeyShortCut']['Backquote'];
    delete this.global.p5key['KeyShortCut']['Digit'];
    delete this.global.p5key['KeyShortCut']['AddAct'];
    this.StopScan();
  }
}
