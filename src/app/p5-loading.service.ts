import { Injectable } from '@angular/core';
import * as p5 from 'p5';
import { isDarkMode } from './global-act.service';
import { LanguageSettingService } from './language-setting.service';

interface LoadingForm {
  /** 진행하는 id, 계속 참조를 위해 구성됨 */
  id: string;
  /** 대표이미지 주소, 값이 있는 경우 이미지가 표시됨 */
  image?: string;
  /** 표시되는 메시지 */
  message?: string;
  /** message 를 보여주는 개체 */
  messageElement?: p5.Element;
  /** 진행도 표시 (0~1) */
  progress?: number;
  /** 진행도 개체 */
  progressElement?: p5.Element;
  /** 진행도가 없는 경우 무한 로딩처리, 이 녀석은 무한 로딩 표현용 (0~100) */
  nullProgress?: number;
  /** 이 행동을 진행중인 개체 기억 */
  element?: p5.Element;
  /** 적용된 투명도 수치 */
  fade?: number;
  /** 진행도와 무관하게 강제로 종료하기 (millis 후에) */
  forceEnd?: number;
}

@Injectable({
  providedIn: 'root'
})
export class P5LoadingService {

  constructor(
    private lang: LanguageSettingService,
  ) { }

  /** 로딩을 전체 관리하는 p5 */
  private CurrentLoading: p5;
  /** 현재 진행중인 로딩 정보들 */
  private loadingStack: { [id: string]: LoadingForm } = {};
  /** loadingStack.keys() */
  private stackKeys: string[] = [];
  /** 즉시 추가가 되지 않은 경우 */
  private queued: LoadingForm[] = [];
  /** 모든 로딩을 담고 있는 부모 div */
  private parentDiv: p5.Element;
  /** 로딩 개체 추가하기 함수 */
  private AddLoadingInfo: Function;

  /** 백그라운드 로딩을 생성합니다 */
  private create(info: LoadingForm) {
    // 현재 사용중인 로딩이 없다면 새로 생성하기
    if (!this.CurrentLoading) {
      this.CurrentLoading = new p5((p: p5) => {
        p.setup = () => {
          p.noCanvas();
          this.parentDiv = p.createDiv();
          this.parentDiv.style("position: absolute; left: 0; top: 0; z-index: 1");
          this.parentDiv.style("width: 100%; height: fit-content");
          this.parentDiv.style("padding: 16px;");
          this.parentDiv.style("display: flex; flex-direction: column");
          this.parentDiv.style("gap: 8px");
          this.parentDiv.style("justify-content: center;");
          this.parentDiv.style("pointer-events: none");

          this.AddLoadingInfo = (info: LoadingForm) => {
            this.loadingStack[info.id] = info;
            // 로딩 칸 전체
            this.stackKeys = Object.keys(this.loadingStack);
            const thisLoading = p.createDiv();
            this.loadingStack[info.id].element = thisLoading;
            thisLoading.style("width: 100%; height: fit-content");
            thisLoading.style("word-break: break-all");
            thisLoading.style('background: var(--toast-background-color)');
            thisLoading.style("border-radius: 32px");
            thisLoading.style("padding: 8px");
            thisLoading.style("color: white");
            thisLoading.parent(this.parentDiv);
            // 레이아웃용 flex-div
            const flex_outlook = p.createDiv();
            flex_outlook.style('display: flex; flex-direction: row;');
            flex_outlook.parent(thisLoading);
            // 이미지가 있는 경우 이미지 표시하기
            const img = p.createImg(info.image, 'ld_img');
            img.style('width: 32px; height: 32px;');
            img.style('margin-left: 8px');
            img.style('object-fit: cover');
            img.style('border-radius: 24px;');
            // 양식은 만들어두고 숨기기
            if (!info.image) img.hide();
            img.parent(flex_outlook);
            // 텍스트 및 진행도 내용물 구성 틀
            const contentForm = p.createDiv();
            contentForm.style('display: flex; flex-direction: row;');
            contentForm.style('gap: 4px');
            contentForm.style('overflow: hidden');
            contentForm.style('flex-grow: 1');
            contentForm.style('align-items: center');
            contentForm.style('margin-right: 8px');
            contentForm.parent(flex_outlook);
            // 지정된 텍스트
            const message = p.createDiv(info.message || this.lang.text['TodoDetail']['WIP']);
            message.style('margin-left: 16px');
            message.style('flex-grow: 1');
            message.style('overflow: hidden');
            message.style('white-space: nowrap');
            message.style('text-overflow: ellipsis');
            info.messageElement = message;
            message.parent(contentForm);
            // 진행도 표시
            const progress = p.createDiv();
            progress.style('width: 24px; height: 24px;');
            progress.style('flex-shrink: 0');
            progress.style('border-radius: 50%');
            const floatAsPercent = Math.floor(info.progress * 100) || 0;
            progress.style(`background: conic-gradient(var(--loading-done-color) 0% ${floatAsPercent}%, var(--loading-waiting-color) ${floatAsPercent}% 100%)`);
            info.progressElement = progress;
            info.nullProgress = 0;
            progress.parent(contentForm);
            info.fade = 0;
          }
          this.AddLoadingInfo(info);
        }
        p.draw = () => {
          // 예약 대기열에 추가된 것을 실제 정보로 옮김
          for (let i = this.queued.length - 1; i >= 0; i--) {
            this.AddLoadingInfo(this.queued[i]);
            this.queued.splice(i, 1);
          }
          // 투명도 조정 FadeIn
          for (let key of this.stackKeys) {
            // 진행도 정보가 없다면 회전시키기
            if (this.loadingStack[key].progress === undefined) {
              this.loadingStack[key].nullProgress = (this.loadingStack[key].nullProgress + 2) % 120;
              const floatAsPercent = this.loadingStack[key].nullProgress;
              this.loadingStack[key].progressElement.style(`background: conic-gradient(var(--loading-waiting-color) 0% ${floatAsPercent - 20}%, var(--loading-done-color) ${floatAsPercent - 20}% ${floatAsPercent}%, var(--loading-waiting-color) ${floatAsPercent}% 100%)`);
            }
            // 강제 종료가 예정되어있다면 초를 세고 종료시키기
            if (this.loadingStack[key].forceEnd !== undefined && this.loadingStack[key].forceEnd > 0)
              this.loadingStack[key].forceEnd -= 7;
            // 로딩이 끝나면 FadeOut
            if (this.loadingStack[key].forceEnd <= 0 || this.loadingStack[key].progress > 1) {
              if (this.loadingStack[key].fade > 0) {
                this.loadingStack[key].fade -= .07;
                this.loadingStack[key].element.style(`opacity: ${this.loadingStack[key].fade}`);
                if (this.loadingStack[key].fade <= 0) {
                  this.loadingStack[key].element.remove();
                  delete this.loadingStack[key];
                  this.stackKeys = Object.keys(this.loadingStack);
                }
              } else {
                this.loadingStack[key].element.remove();
                delete this.loadingStack[key];
                this.stackKeys = Object.keys(this.loadingStack);
              }
            } else {
              // 처음에 시작할 때 FadeIn
              if (this.loadingStack[key].fade < 1) {
                this.loadingStack[key].fade += .07;
                if (this.loadingStack[key].fade >= 1)
                  this.loadingStack[key].fade = 1;
                this.loadingStack[key].element.style(`opacity: ${this.loadingStack[key].fade}`);
              }
            }
          }
          // 완벽한 유휴 상태 확인시 삭제
          if (!this.stackKeys.length) RemoveLoading();
        }
        /** p5 로딩 개체를 삭제함 */
        let RemoveLoading = () => {
          p.remove();
          this.parentDiv = null;
          this.CurrentLoading = null;
          this.AddLoadingInfo = null;
          this.stackKeys.length = 0;
        }
      });
    } else if (this.AddLoadingInfo) this.AddLoadingInfo(info);
    else this.queued.push(info);
  }

  /** 특정 로딩 정보를 업데이트함, 해당 정보가 없다면 로딩을 새로 만들기
   * @param [only_update=false] 새로 생성하지 않고 업데이트만 하는 경우
   */
  update(info: LoadingForm, only_update = false) {
    if (this.stackKeys.includes(info.id)) {
      if (info.forceEnd !== undefined) {
        this.loadingStack[info.id].forceEnd = info.forceEnd;
        if (this.loadingStack[info.id].progress) {
          this.loadingStack[info.id].progress = 1;
          this.loadingStack[info.id].progressElement.style('background: conic-gradient(var(--loading-done-color) 0% 100%');
        }
      }
      if (info.message !== undefined) {
        if (info.message === null) {
          delete this.loadingStack[info.id];
          this.loadingStack[info.id].messageElement.html();
        } else {
        this.loadingStack[info.id].message = info.message;
        this.loadingStack[info.id].messageElement.html(info.message);
        }
      }
      if (info.progress !== undefined) {
        if (info.progress === null) {
          delete this.loadingStack[info.id].progress;
        } else {
        this.loadingStack[info.id].progress = info.progress;
        const floatAsPercent = Math.floor(info.progress * 100);
        this.loadingStack[info.id].progressElement.style(`background: conic-gradient(var(--loading-done-color) 0% ${floatAsPercent}%, var(--loading-waiting-color) ${floatAsPercent}% 100%)`);
        }
      }
    } else if (!only_update) this.create(info);
  }

  /** 로딩 삭제하기 */
  remove(id: string) {
    this.update({
      id: id,
      forceEnd: 100,
    }, true);
  }
}
