import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { GlobalActService } from 'src/app/global-act.service';
import { LanguageSettingService } from 'src/app/language-setting.service';
import { NakamaService, ServerInfo } from 'src/app/nakama.service';
import { GroupServerPage } from '../../settings/group-server/group-server.page';

@Component({
  selector: 'app-add-post',
  templateUrl: './add-post.page.html',
  styleUrls: ['./add-post.page.scss'],
})
export class AddPostPage implements OnInit {
  constructor(
    private global: GlobalActService,
    public lang: LanguageSettingService,
    private navCtrl: NavController,
    private nakama: NakamaService,
    private modalCtrl: ModalController,
  ) { }

  servers: ServerInfo[] = [];
  userInput = {
    title: undefined,
    /** 대표 이미지 설정, blob 링크 */
    titleImage: undefined,
    /** 내용물, txt 파일 변환하여 저장됨 */
    content: undefined,
    creator_id: undefined,
    creator_name: undefined,
    UserColor: undefined,
    create_time: undefined,
    modify_time: undefined,
    server: undefined,
  }
  index = 0;
  isOfficial: string;
  target: string;

  ngOnInit() {
    this.servers = this.nakama.get_all_server_info(true, true);
    this.select_server(0);
    this.userInput.creator_name = this.nakama.users.self['display_name'];
  }

  BottomTabShortcut: any;
  /** 하단 탭 단축키 캐싱 */
  catchBottomTabShortCut() {
    this.BottomTabShortcut = this.global.p5key['KeyShortCut']['BottomTab'];
    delete this.global.p5key['KeyShortCut']['BottomTab'];
  }

  ionViewWillEnter() {
    this.AddShortcut();
    this.catchBottomTabShortCut();
  }

  go_to_profile() {
    this.modalCtrl.create({
      component: GroupServerPage,
      componentProps: {
        isOfficial: this.isOfficial,
        target: this.target,
      }
    }).then(v => v.present());
  }

  /** 서버 선택지 열림 여부 */
  isExpanded = false;
  /** 저장버튼 눌림 여부 */
  isSaveClicked = false;
  /** 아코디언에서 서버 선택하기 */
  select_server(i: number) {
    this.index = i;
    this.userInput.server = this.servers[i];
    this.isExpanded = false;
    this.isOfficial = this.servers[i].isOfficial;
    this.target = this.servers[i].target;
    // 변경된 서버 user_id 를 적용함
    this.userInput.creator_id = this.nakama.servers[this.isOfficial][this.target].session.user_id;
    this.userInput.UserColor = (this.userInput.creator_id.replace(/[^5-79a-b]/g, '') + 'abcdef').substring(0, 6);
  }

  /** 단축키 생성 */
  AddShortcut() {
    if (this.global.p5key && this.global.p5key['KeyShortCut']) {
      this.global.p5key['KeyShortCut']['Escape'] = () => {
        this.navCtrl.navigateBack('portal/community');
      };
    }
  }

  /** 포스트 등록하기  
   * 글 내용이 길어질 수 있으므로 글이 아무리 짧더라도 txt 파일로 변환하여 게시
   */
  UploadPost() {
    this.isSaveClicked = true;
    // 너무 긴 제목 자르기
    // 게시글의 도입부 첫 줄 자르기
    // 게시물 날짜 업데이트
    if (this.userInput.create_time) { // 생성 시간이 있다면 편집으로 간주
      this.userInput.modify_time = new Date().getTime();
    } else { // 생성 시간이 없다면 최초 생성으로 간주
      this.userInput.create_time = new Date().getTime();
    }
    // 서버 정보 지우기
    // 전체 정보(UserInput)를 텍스트 파일화
    // 서버에 동기화
  }

  ionViewWillLeave() {
    delete this.global.p5key['KeyShortCut']['Escape'];
    this.global.p5key['KeyShortCut']['BottomTab'] = this.BottomTabShortcut;
  }
}
