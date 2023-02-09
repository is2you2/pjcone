extends RigidBody2D


export var title:String

var info:Dictionary
export var parent_script:NodePath
var window

func _ready():
	if info.has('title'):
		title = info.title
	if title:
		$CollisionShape2D/Node2D/UI/Label.text = title
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')



func _process(_delta):
	rotation = 0

var test_todo_index:= 0
# 클릭 받아내기
func _on_UI_gui_input(event):
	if event is InputEventMouseButton or event is InputEventScreenTouch:
		if event.pressed:
			if ($CollisionShape2D/Node2D/UI.rect_size / 2).distance_to(event.position) <= $CollisionShape2D.shape.radius:
				if window: # 웹에서 사용됨
					if info.has('id'): # 생성된 할 일 정보
						window.add_todo_menu(JSON.print(info))
					else: # 새로 만들기
						window.add_todo_menu()
				else: # 엔진 테스트중
					if info.has('id'): # 생성된 할 일 정보
						print_debug(info)
					else: # 새로 만들기
						test_todo_index = (test_todo_index + 1) % 3
						get_node(parent_script).add_todo([JSON.print({
							'id': 'engine_test_id',
							'title': '엔진_test_title',
							'written': 'user_id',
							'limit': 0,
							'importance': str(test_todo_index),
							'logs': [],
							'description': 'test_desc',
							'remote': null,
							'attach': {},
						})])
