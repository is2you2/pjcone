import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PostViewerPage } from './post-viewer.page';

describe('PostViewerPage', () => {
  let component: PostViewerPage;
  let fixture: ComponentFixture<PostViewerPage>;

  beforeEach(async(() => {
    fixture = TestBed.createComponent(PostViewerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
