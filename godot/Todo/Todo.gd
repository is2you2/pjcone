## SPDX-FileCopyrightText: © 2023 그림또따 <is2you246@gmail.com>
## SPDX-License-Identifier: MIT

extends Node

# iframe 창
var window
var add_todo_func = JavaScript.create_callback(self, 'add_todo')
var remove_todo_func = JavaScript.create_callback(self, 'remove_todo')

# 앱 시작과 동시에 동작하려는 pck 정보를 받아옴
func _ready():
	# 구성 폴더가 없으면 폴더 생성
	var dir:= Directory.new()
	if not dir.dir_exists('user://todo/'):
		dir.make_dir('user://todo/')
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	if dir.open('user://todo/') == OK:
		dir.list_dir_begin(true, true)
		var ls = dir.get_next()
		while ls:
			var file:= File.new()
			var err:= file.open('user://todo/%s/info.todo' % ls, File.READ)
			if err == OK:
				add_todo([file.get_as_text()])
			file.close()
			ls = dir.get_next()
		dir.list_dir_end()
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.add_todo = add_todo_func
		window.remove_todo = remove_todo_func
	else: # 엔진에서 테스트중일 때
		print_debug('on test...')

var ele_0:= preload("res://TodoEle_0.tscn")
var ele_1:= preload("res://TodoEle_1.tscn")
var ele_2:= preload("res://TodoEle_2.tscn")
# 해야할 일 추가하기
func add_todo(args):
	var json = JSON.parse(args[0]).result
	if json is Dictionary:
		# 추가하기 구성 변경
		if not $Todos/Todo_Add.visible:
			$EmptyTodo.hide()
			$Todos/Todo_Add.visible = true
		var new_todo # 해야할 일 정보
		# 기존에 가지고 있는 해야할 일인지 정보 검토
		var children:= $Todos/TodoElements.get_children()
		var check_exist:= false
		var checked_node
		for child in children:
			if child.name == json.id:
				checked_node = child
				check_exist = true
				break
		if check_exist:
			checked_node.name = 'will_remove'
			checked_node.queue_free()
		match(json.importance):
			'0': # 메모
				new_todo = ele_0.instance()
			'1': # 기억해야함
				new_todo = ele_1.instance()
			'2': # 중요함
				new_todo = ele_2.instance()
		# 필수 정보 입력
		new_todo.name = json.id
		new_todo.info = json
		# 랜덤한 위치에서 생성
		var max_dist:float = $Todos/Area2D/CollisionShape2D.shape.radius
		$Todos/Area2D/GenerateHere.position = Vector2(max_dist - 100, 0)
		randomize()
		$Todos/Area2D.rotation = deg2rad(randf() * 720 - 360)
		new_todo.position = $Todos/Area2D/GenerateHere.global_position
		$Todos/TodoElements.add_child(new_todo)
	else: printerr('json import error')

# 해야할 일 개체 삭제
func remove_todo(args):
	var json = JSON.parse(args[0]).result
	if json is Dictionary:
		var new_todo # 해야할 일 정보
		# 기존에 가지고 있는 해야할 일인지 정보 검토
		var children:= $Todos/TodoElements.get_children()
		for child in children:
			if child.name == json.id:
				child.name = 'will_remove'
				child.queue_free()
				break
		# 추가하기 구성 변경
		if children.size() == 1:
			$EmptyTodo.show()
			$Todos/Todo_Add.visible = false
	else: printerr('json import error')


func _on_Add_gui_input(event):
	if event is InputEventMouseButton:
		if event.pressed:
			if window:
				window.add_todo_menu()
			else:
				print_debug('editor test add todo')
				add_todo([JSON.print({
					'id': 'engine_test_id',
					'title': '엔진_test_title',
					'written': 'user_id',
					'limit': 0,
					'importance': '0',
					'logs': [],
					'description': 'test_desc',
					'remote': null,
					'attach': {},
				})])


# Control 노드를 이용한 화면 크기 검토용
var window_size:Vector2
const GEN_MARGIN:= 200
func _process(_delta):
	window_size = $Todos.rect_size
	$Todos/Area2D.position = window_size / 2
	$Todos/Area2D/CollisionShape2D.shape.radius = window_size.x + GEN_MARGIN if window_size.x > window_size.y else window_size.y + GEN_MARGIN
