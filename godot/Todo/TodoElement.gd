## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT
extends RigidBody2D


export var title:String


var info:Dictionary
export var parent_script:NodePath
var window
var parent_node
var line_color:Color
var normal_color:Color
var alert_color:Color
var lerp_start_from:= 0.0
var is_add_button:= false


# 재시작하기 전까지 ionic으로부터 받은 정보는 공유되지 않는다
func _ready():
	if info.has('title'):
		title = info.title
		if info.attach.has('filename'):
			try_to_load_attach()
	else: is_add_button = true
	if title:
		$CollisionShape2D/Node2D/UI/Label.text = title
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
	if not parent_script:
		parent_script = '../../..'
	parent_node = get_node(parent_script)


# 파일 불러오기 시도
# 다시 로드되기 전까지는 경로가 업데이트되지 않는 오류가 있다
func try_to_load_attach():
	var dir:= Directory.new()
	var check_exist:= dir.file_exists('user://todo/%s/%s' % [info.id, info.attach.filename])
	if check_exist:
		var img:= Image.new()
		img.load('user://todo/%s/%s' % [info.id, info.attach.filename])
		var tex:= ImageTexture.new()
		tex.create_from_image(img)
		$CollisionShape2D/Node2D/UI/Attach.texture = tex
	else:
		printerr('다시 로드되기 전까지는 경로가 업데이트 되지 않음')


var lerp_value:= 0.0
var color_lerp_with_limit:= 0.0
func calc_lerpVal():
	if info.limit < parent_node.current_time:
		lerp_value = 1
		color_lerp_with_limit = 1
	else:
		lerp_value = clamp(map(parent_node.current_time, info.written, info.limit, 0, 1), 0, 1)
		color_lerp_with_limit = clamp(map(lerp_value, lerp_start_from, 1, 0, 1), 0, 1)


func _process(_delta):
	rotation = 0
	if not is_add_button: # 추가 버튼을 제외한 행동
		calc_lerpVal()
		linear_damp = 4 - lerp_value
		angular_damp = 4 - lerp_value
		$CollisionShape2D/Node2D/Sprite.modulate = normal_color.linear_interpolate(alert_color, color_lerp_with_limit)
		$CollisionShape2D/Node2D/UI.update()


func map(value, InputA, InputB, OutputA, OutputB):
	return (value - InputA) / (InputB - InputA) * (OutputB - OutputA) + OutputA


var test_todo_index:= 0
# 클릭 받아내기
func _on_UI_gui_input(event):
	if event is InputEventMouseButton:
		if not event.pressed:
			if ($CollisionShape2D/Node2D/UI.rect_size / 2).distance_to(event.position) <= $CollisionShape2D.shape.radius:
				if OS.has_feature('JavaScript'): # 웹에서 사용됨
					if info.has('id'): # 생성된 할 일 정보
						window.add_todo_menu(JSON.print(info))
					else: # 새로 만들기
						window.add_todo_menu()
				else: # 엔진 테스트중
					if info.has('id'): # 생성된 할 일 정보
						print_debug(info)
					else: # 새로 만들기
						test_todo_index = (test_todo_index + 1) % 3
						parent_node.add_todo([JSON.print({
							'id': 'engine_test_id',
							'title': '엔진_test_title',
							'written': OS.get_system_time_msecs(),
							'limit': OS.get_system_time_msecs() + 10000,
							'importance': str(test_todo_index),
							'logs': [],
							'description': 'test_desc',
							'remote': null,
							'attach': {},
						})])
