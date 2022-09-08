import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { NakamaService } from 'src/app/nakama.service';
import { P5ToastService } from 'src/app/p5-toast.service';

interface ServerInfo {
  title: string;
  isOfficial: string;
  target: string;
  key: string;
}

interface GroupInfo {
  id: string;
  title: string;
  desc: string;
  max: number;
  lang: string;
  isPublic: boolean;
}

@Component({
  selector: 'app-add-group',
  templateUrl: './add-group.page.html',
  styleUrls: ['./add-group.page.scss'],
})
export class AddGroupPage implements OnInit {

  constructor(
    private navCtrl: NavController,
    private p5toast: P5ToastService,
    private nakama: NakamaService,
  ) { }

  ngOnInit() {
    let tmp = JSON.parse(localStorage.getItem('add-group'));
    if (tmp)
      this.userInput = tmp;
  }

  userInput: GroupInfo = {
    id: undefined,
    title: '',
    desc: '',
    max: undefined,
    lang: undefined,
    isPublic: false,
  }

  /** 서버 정보, 온라인 상태의 서버만 불러온다 */
  server_list: ServerInfo[] = [{
    title: '개발 테스트 서버_test',
    isOfficial: 'official',
    target: 'default',
    key: 'default',
  }, {
    title: 'test2 (x) 동작 안함',
    isOfficial: 'unofficial',
    target: 'default',
    key: 'default',
  }];
  selected_index = 0;
  isExpanded = true;

  /** 아코디언에서 서버 선택하기 */
  select_server(i: number) {
    this.selected_index = i;
    this.isExpanded = false;
  }

  /** 공개여부 토글 */
  isPublicToggle() {
    this.userInput.isPublic = !this.userInput.isPublic;
  }

  isSaveClicked = false;
  /** 정상처리되지 않았다면 작성 중 정보 임시 저장 */
  isSavedWell = false;
  save() {
    let client = this.nakama.client[this.server_list[this.selected_index].isOfficial][this.server_list[this.selected_index].target];
    if (!client) { // 클라이언트 존재 여부 검토
      this.p5toast.show({
        text: '선택한 서버를 사용할 수 없습니다.',
      });
      return;
    }

    let session = this.nakama.session[this.server_list[this.selected_index].isOfficial][this.server_list[this.selected_index].target][this.server_list[this.selected_index].key];

    if (!session) { // 세션 검토
      // ## refreshToken 등 검토 필요
      this.p5toast.show({
        text: '세션이 종료되었습니다.',
        duration: .1,
      });
      return;
    }

    this.isSaveClicked = true;
    client.createGroup(session, {
      name: this.userInput.title,
      lang_tag: this.userInput.lang ?? 'ko',
      description: this.userInput.desc,
      max_count: this.userInput.max ?? 2,
      open: this.userInput.isPublic,
    }).then(v => {
      this.userInput.id = v.id;
      setTimeout(() => {
        this.p5toast.show({
          text: '그룹이 생성되었습니다.',
          duration: .1,
        });
        this.isSavedWell = true;
        localStorage.removeItem('add-group');
        this.navCtrl.back();
      }, 500);
    }).catch(e => {
      console.error('그룹 생성 실패: ', e);
      switch (e.status) {
        case 400:
          setTimeout(() => {
            this.p5toast.show({
              text: '잘못된 요청입니다.',
              duration: .1,
            });
            this.isSaveClicked = false;
          }, 500);
          break;
        case 409:
          setTimeout(() => {
            this.p5toast.show({
              text: '이미 같은 이름의 그룹이 존재합니다.',
              duration: .1,
            });
            this.isSaveClicked = false;
          }, 500);
          break;
        default:
          setTimeout(() => {
            this.p5toast.show({
              text: `준비되지 않은 오류처리: ${e}`,
              duration: .1,
            });
            this.isSaveClicked = false;
          }, 500);
          break;
      }
    });
  }

  ionViewWillLeave() {
    if (!this.isSavedWell)
      localStorage.setItem('add-group', JSON.stringify(this.userInput));
  }
}
